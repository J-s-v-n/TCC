import base64
import io
import os
import tempfile
from typing import Optional, List

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from skimage import measure, morphology
from sklearn.cluster import DBSCAN
from tensorflow import keras
from scipy.spatial.distance import cdist

app = FastAPI(title="TCC Image Analyzer")

# CORS configuration - must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "TCC Image Analyzer API is running"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

# ---- Parameters (Single Image) ----
THRESHOLD_K = 241
MIN_AREA_PIXELS = 500
EPS_PX = 138
MIN_SAMPLES = 1
MASK_MIN_AREA = 285

# ---- Parameters (Multi Image Tracking) ----
CONVLSTM_MODEL_PATH = "models/convlstm_tcc_full_model.h5"
CONVLSTM_INPUT_SHAPE = (5, 256, 256, 1)
PREDICTION_THRESHOLD = 0.5  # Threshold for binary mask from probability
TRACKING_DISTANCE_THRESHOLD = 50.0  # pixels - max distance to match blobs across frames
MIN_PERSISTENCE_FRAMES = 3  # Minimum frames to count as "persistent"
MIN_SPEED_FOR_MOTION = 5.0  # pixels/frame - minimum for "sustained motion"


def normalize_to_uint8(arr: np.ndarray) -> np.ndarray:
    arr = (arr - np.min(arr)) / (np.max(arr) - np.min(arr) + 1e-8)
    return (arr * 255).astype(np.uint8)


def to_data_url(content: bytes, mime: str) -> str:
    b64 = base64.b64encode(content).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def load_bt(file_path: str) -> np.ndarray:
    try:
        with h5py.File(file_path, "r") as f:
            if "TIR1_BT" in f:
                return np.array(f["TIR1_BT"])[0, :, :]
            # fallback: grab first dataset
            for key in f.keys():
                data = np.array(f[key])
                if data.ndim >= 2:
                    return data[0, :, :] if data.ndim == 3 else data
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read H5: {exc}") from exc
    raise HTTPException(status_code=400, detail="No usable dataset found in H5 file.")


def postprocess_mask(mask_u8: np.ndarray) -> np.ndarray:
    m = mask_u8 > 0
    m = morphology.opening(m, morphology.disk(2))
    m = morphology.closing(m, morphology.disk(3))
    m = morphology.remove_small_objects(m, min_size=MASK_MIN_AREA)
    return m.astype(np.uint8) * 255


def blob_props(mask_bin: np.ndarray, raw_gray: np.ndarray) -> pd.DataFrame:
    labeled = measure.label(mask_bin > 127, connectivity=2)
    props = measure.regionprops(labeled, intensity_image=raw_gray)
    rows = []
    for p in props:
        intens = p.intensity_image[p.image]
        if intens.size == 0:
            continue
        r, c = p.centroid
        rows.append(
            {
                "blob_id": int(p.label),
                "centroid_row": float(r),
                "centroid_col": float(c),
                "pixel_count": int(p.area),
                "mean_Tb": float(np.mean(intens)),
                "min_Tb": float(np.min(intens)),
                "max_Tb": float(np.max(intens)),
                "std_Tb": float(np.std(intens)),
                "equiv_radius_px": float(np.sqrt(p.area / np.pi)),
            }
        )
    return pd.DataFrame(rows)


def group_dbscan(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    if len(df) == 0:
        return df, pd.DataFrame()
    X = df[["centroid_row", "centroid_col"]].values
    labels = DBSCAN(eps=EPS_PX, min_samples=MIN_SAMPLES).fit_predict(X)
    df = df.copy()
    df["system_id"] = labels
    systems = (
        df.groupby("system_id")
        .agg(
            pixel_count=("pixel_count", "sum"),
            mean_Tb=("mean_Tb", "mean"),
            min_Tb=("min_Tb", "min"),
            max_Tb=("max_Tb", "max"),
            std_Tb=("std_Tb", "mean"),
            centroid_row=("centroid_row", "mean"),
            centroid_col=("centroid_col", "mean"),
            mean_radius_px=("equiv_radius_px", "mean"),
        )
        .reset_index()
    )
    return df, systems


# ============================================================================
# MULTI-IMAGE TRACKING FUNCTIONS
# ============================================================================

def load_convlstm_model(model_path: str):
    """
    Load the pretrained ConvLSTM model.
    Returns: Loaded model object
    """
    # Resolve model path relative to backend directory
    if not os.path.isabs(model_path):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(backend_dir, model_path)
    
    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=500,
            detail=f"ConvLSTM model not found at {model_path}. Please ensure the model file exists."
        )
    
    try:
        model = keras.models.load_model(model_path, compile=False)  # compile=False for inference only
        return model
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load ConvLSTM model from {model_path}: {str(e)}"
        )


def preprocess_for_convlstm(bt_data: np.ndarray, target_shape=(256, 256)) -> np.ndarray:
    """
    Preprocess BT data for ConvLSTM input.
    - Resize to target_shape
    - Min-max normalize
    - Expand dims to (H, W, 1)
    """
    # Convert to float32
    bt = bt_data.astype(np.float32)

    # Resize to model input size
    bt_resized = np.array(
        Image.fromarray(bt).resize(target_shape, resample=Image.BILINEAR)
    )

    # Min-max normalization
    bt_min = bt_resized.min()
    bt_max = bt_resized.max()
    bt_norm = (bt_resized - bt_min) / (bt_max - bt_min + 1e-6)

    # Add channel dimension
    return bt_norm[..., np.newaxis]


def predict_next_frame(model, input_frames: np.ndarray) -> np.ndarray:
    """
    Use ConvLSTM to predict the next frame.
    
    Args:
        model: Loaded ConvLSTM model
        input_frames: Array of shape (5, 256, 256, 1) - 5 previous frames
    
    Returns:
        Probability mask of shape (256, 256) with values in [0, 1]
    """
    # Reshape to batch format: (1, 5, 256, 256, 1)
    input_batch = np.expand_dims(input_frames, axis=0)
    
    # Predict next frame
    prediction = model.predict(input_batch, verbose=0)
    
    # Extract 2D mask: if output is (1, 256, 256, 1), take [0, :, :, 0]
    # Handle different possible output shapes
    if prediction.ndim == 4:
        if prediction.shape[0] == 1:
            pred_mask = prediction[0, :, :, 0] if prediction.shape[-1] == 1 else prediction[0, :, :]
        else:
            pred_mask = prediction[:, :, 0] if prediction.shape[-1] == 1 else prediction
    elif prediction.ndim == 3:
        pred_mask = prediction[:, :, 0] if prediction.shape[-1] == 1 else prediction
    else:
        pred_mask = prediction
    
    return pred_mask.astype(np.float32)


def detect_tcc_blobs(predicted_mask: np.ndarray, threshold: float = 0.5) -> pd.DataFrame:
    """
    Detect TCC blobs from predicted probability mask.
    - Threshold to get binary mask
    - Connected component labeling
    - Compute blob properties (area, centroid)
    
    Args:
        predicted_mask: Probability mask of shape (256, 256)
        threshold: Threshold for binary mask
    
    Returns:
        DataFrame with columns: blob_id, area, centroid_x, centroid_y
    """
    # Threshold to binary mask
    binary_mask = (predicted_mask >= threshold).astype(np.uint8)
    
    # Apply morphological cleanup
    cleaned_mask = postprocess_mask(binary_mask * 255)
    binary_cleaned = (cleaned_mask > 127).astype(bool)
    
    # Connected component labeling
    labeled = measure.label(binary_cleaned, connectivity=2)
    props = measure.regionprops(labeled)
    
    rows = []
    for p in props:
        if p.area == 0:
            continue
        centroid_col, centroid_row = p.centroid  # x, y format
        rows.append({
            "blob_id": int(p.label),
            "area": int(p.area),
            "centroid_x": float(centroid_col),  # x = column
            "centroid_y": float(centroid_row),  # y = row
        })
    
    return pd.DataFrame(rows)


def track_blobs_across_frames(all_blob_dfs: List[pd.DataFrame]) -> pd.DataFrame:
    """
    Track blobs across multiple frames using centroid distance.
    Assigns unique track_id to each cloud system.
    
    Args:
        all_blob_dfs: List of DataFrames, each with columns: frame_id, blob_id, centroid_x, centroid_y, area
                     One DataFrame per frame in chronological order
    
    Returns:
        DataFrame with columns: track_id, frame_id, blob_id, centroid_x, centroid_y, area, speed
    """
    if not all_blob_dfs:
        return pd.DataFrame(columns=["track_id", "frame_id", "blob_id", "centroid_x", "centroid_y", "area", "speed"])
    
    # Initialize tracks with first frame
    tracks_list = []
    next_track_id = 0
    
    # First frame: assign initial track_ids
    first_df = all_blob_dfs[0].copy()
    for _, row in first_df.iterrows():
        tracks_list.append({
            "track_id": next_track_id,
            "frame_id": int(row["frame_id"]),
            "blob_id": int(row["blob_id"]),
            "centroid_x": float(row["centroid_x"]),
            "centroid_y": float(row["centroid_y"]),
            "area": int(row["area"]),
            "speed": 0.0  # No speed for first frame
        })
        next_track_id += 1
    
    # Track subsequent frames
    for frame_idx in range(1, len(all_blob_dfs)):
        current_df = all_blob_dfs[frame_idx].copy()
        prev_frame_tracks = [t for t in tracks_list if t["frame_id"] == frame_idx - 1]
        
        if not prev_frame_tracks:
            # No previous tracks, assign new track_ids to all blobs
            for _, row in current_df.iterrows():
                tracks_list.append({
                    "track_id": next_track_id,
                    "frame_id": int(row["frame_id"]),
                    "blob_id": int(row["blob_id"]),
                    "centroid_x": float(row["centroid_x"]),
                    "centroid_y": float(row["centroid_y"]),
                    "area": int(row["area"]),
                    "speed": 0.0
                })
                next_track_id += 1
            continue
        
        # Build distance matrix
        prev_centroids = np.array([[t["centroid_x"], t["centroid_y"]] for t in prev_frame_tracks])
        curr_centroids = current_df[["centroid_x", "centroid_y"]].values
        
        if len(curr_centroids) == 0:
            continue
        
        # Compute pairwise distances
        distances = cdist(curr_centroids, prev_centroids, metric='euclidean')
        
        # Match each current blob to nearest previous blob within threshold
        matched_prev_indices = set()
        for curr_pos, (_, row) in enumerate(current_df.iterrows()):
            if distances.shape[1] == 0:
                # No previous blobs, create new track
                tracks_list.append({
                    "track_id": next_track_id,
                    "frame_id": int(row["frame_id"]),
                    "blob_id": int(row["blob_id"]),
                    "centroid_x": float(row["centroid_x"]),
                    "centroid_y": float(row["centroid_y"]),
                    "area": int(row["area"]),
                    "speed": 0.0
                })
                next_track_id += 1
                continue
            
            min_dist_idx = np.argmin(distances[curr_pos, :])
            min_distance = distances[curr_pos, min_dist_idx]
            
            if min_distance <= TRACKING_DISTANCE_THRESHOLD and min_dist_idx not in matched_prev_indices:
                # Match found - continue track
                prev_track = prev_frame_tracks[min_dist_idx]
                prev_centroid = np.array([prev_track["centroid_x"], prev_track["centroid_y"]])
                curr_centroid = np.array([row["centroid_x"], row["centroid_y"]])
                speed = np.linalg.norm(curr_centroid - prev_centroid)
                
                tracks_list.append({
                    "track_id": prev_track["track_id"],
                    "frame_id": int(row["frame_id"]),
                    "blob_id": int(row["blob_id"]),
                    "centroid_x": float(row["centroid_x"]),
                    "centroid_y": float(row["centroid_y"]),
                    "area": int(row["area"]),
                    "speed": float(speed)
                })
                matched_prev_indices.add(min_dist_idx)
            else:
                # No match within threshold - create new track
                tracks_list.append({
                    "track_id": next_track_id,
                    "frame_id": int(row["frame_id"]),
                    "blob_id": int(row["blob_id"]),
                    "centroid_x": float(row["centroid_x"]),
                    "centroid_y": float(row["centroid_y"]),
                    "area": int(row["area"]),
                    "speed": 0.0
                })
                next_track_id += 1
    
    tracks_df = pd.DataFrame(tracks_list)
    return tracks_df


def predict_cyclogenesis(tracks_df: pd.DataFrame) -> pd.DataFrame:
    """
    Rule-based cyclogenesis prediction.
    For each track_id, determine if it shows cyclogenesis potential.
    
    Rules:
    - Persistent: exists for >= MIN_PERSISTENCE_FRAMES
    - Sustained motion: mean speed >= MIN_SPEED_FOR_MOTION
    - cyclogenesis = 1 if both conditions met, else 0
    
    Args:
        tracks_df: DataFrame from track_blobs_across_frames with columns: track_id, speed, frame_id
    
    Returns:
        DataFrame with columns: track_id, cyclogenesis, reason
    """
    if tracks_df.empty:
        return pd.DataFrame(columns=["track_id", "cyclogenesis", "reason"])
    
    results = []
    unique_track_ids = tracks_df["track_id"].unique()
    
    for track_id in unique_track_ids:
        track_data = tracks_df[tracks_df["track_id"] == track_id]
        
        # Persistence = number of consecutive frames
        persistence = len(track_data)
        
        # Mean speed (exclude first frame which has speed=0)
        track_speeds = track_data[track_data["speed"] > 0]["speed"].values
        if len(track_speeds) > 0:
            mean_speed = float(np.mean(track_speeds))
        else:
            mean_speed = 0.0
        
        # Apply rules
        if persistence >= MIN_PERSISTENCE_FRAMES and mean_speed >= MIN_SPEED_FOR_MOTION:
            cyclogenesis = 1
            reason = "Persistent + sustained motion"
        elif persistence < MIN_PERSISTENCE_FRAMES:
            cyclogenesis = 0
            reason = "Not persistent"
        else:  # persistence >= MIN_PERSISTENCE_FRAMES but speed < threshold
            cyclogenesis = 0
            reason = "Low speed"
        
        results.append({
            "track_id": int(track_id),
            "cyclogenesis": int(cyclogenesis),
            "reason": reason
        })
    
    return pd.DataFrame(results)


def create_overlay_visualization(
    bt_array: np.ndarray,
    tracks_df: pd.DataFrame,
    cyclogenesis_df: pd.DataFrame,
    frame_id: int,
) -> bytes:
    """
    Create Phase 3 overlay visualization reusing Phase 2 structure but color-coding by cyclogenesis.
    
    This reuses the exact same visualization as Phase 2 Frame 6, but recolors Track ID labels:
    - RED for tracks where cyclogenesis == 1
    - YELLOW for tracks where cyclogenesis == 0
    
    Args:
        bt_array: BT data for the frame (e.g., last observed frame)
        tracks_df: DataFrame from track_blobs_across_frames with track_id assignments
        cyclogenesis_df: DataFrame from predict_cyclogenesis with track_id and cyclogenesis columns
        frame_id: Frame ID to visualize (typically the last frame)
    
    Returns:
        PNG image bytes
    """
    bt_gray = normalize_to_uint8(bt_array)
    frame_tracks = tracks_df[tracks_df["frame_id"] == frame_id]
    
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.imshow(bt_gray, cmap="gray")
    
    if not frame_tracks.empty and not cyclogenesis_df.empty:
        # Merge track data with cyclogenesis predictions
        frame_tracks_with_cyclo = frame_tracks.merge(cyclogenesis_df, on="track_id", how="left")
        
        # Get unique track IDs in this frame
        track_ids = sorted(frame_tracks_with_cyclo["track_id"].unique())
        
        for track_id in track_ids:
            track_data = frame_tracks_with_cyclo[frame_tracks_with_cyclo["track_id"] == track_id]
            
            # Get cyclogenesis status for this track (should be single value)
            cyclo_status = track_data["cyclogenesis"].iloc[0] if not track_data.empty else 0
            
            # Determine color based on cyclogenesis status ONLY
            if cyclo_status == 1:
                label_color = "red"
                circle_color = "red"
            else:
                label_color = "yellow"
                circle_color = "yellow"
            
            # Draw circle and label for each blob in this track within this frame
            for _, row in track_data.iterrows():
                centroid_x = int(row["centroid_x"])
                centroid_y = int(row["centroid_y"])
                area = int(row["area"])
                
                # Draw circle around cluster
                radius = int(np.sqrt(area / np.pi))
                circle = plt.Circle(
                    (centroid_x, centroid_y),
                    radius,
                    color=circle_color,
                    fill=False,
                    linewidth=2,
                    edgecolor=circle_color
                )
                ax.add_patch(circle)
                
                # Add track ID text label with cyclogenesis-based color
                ax.text(
                    centroid_x,
                    centroid_y - radius - 5,
                    f"TID:{int(track_id)}",
                    color=label_color,
                    fontsize=10,
                    fontweight="bold",
                    ha="center",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="black", alpha=0.7, edgecolor=label_color)
                )
    
    ax.set_title(f"Phase 3: Cyclogenesis Prediction Overlay - Frame {frame_id + 1}\n(Red: Cyclogenesis-prone | Yellow: Normal TCC)")
    ax.axis("off")
    
    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close()
    return buf.getvalue()


def visualize_clusters(raw_img: np.ndarray, blob_df: pd.DataFrame, ts: str) -> Optional[bytes]:
    if blob_df.empty:
        return None
    plt.figure(figsize=(6, 6))
    plt.imshow(raw_img, cmap="gray")
    labels = blob_df["system_id"].unique()
    colors = plt.cm.tab10(np.linspace(0, 1, len(labels)))
    for label, color in zip(labels, colors):
        group = blob_df[blob_df["system_id"] == label]
        plt.scatter(
            group["centroid_col"],
            group["centroid_row"],
            s=group["pixel_count"] / 50,
            color=color,
            edgecolors="white",
            label=f"System {label}",
        )
    plt.title(f"Frame: {ts} | DBSCAN EPS={EPS_PX}")
    plt.legend(loc="upper right", fontsize="x-small", framealpha=0.7)
    plt.axis("off")
    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format="png", dpi=150)
    plt.close()
    return buf.getvalue()


def visualize_tracking_with_ids(
    bt_arrays: List[np.ndarray],
    all_blob_dfs: List[pd.DataFrame],
    tracks_df: pd.DataFrame,
) -> List[bytes]:
    """
    Create visualizations for each frame showing track IDs overlaid on detected clusters.
    
    Args:
        bt_arrays: List of BT data arrays for each frame
        all_blob_dfs: List of blob DataFrames with frame_id for each frame
        tracks_df: DataFrame from track_blobs_across_frames with track_id assignments
    
    Returns:
        List of PNG image bytes, one for each frame
    """
    visualizations = []
    
    unique_frames = sorted(tracks_df["frame_id"].unique())
    
    for frame_id in unique_frames:
        if frame_id >= len(bt_arrays):
            continue
            
        bt_data = bt_arrays[frame_id]
        bt_gray = normalize_to_uint8(bt_data)
        
        frame_tracks = tracks_df[tracks_df["frame_id"] == frame_id]
        
        fig, ax = plt.subplots(figsize=(8, 8))
        ax.imshow(bt_gray, cmap="gray")
        
        if not frame_tracks.empty:
            # Get unique track IDs in this frame
            track_ids = frame_tracks["track_id"].unique()
            colors = plt.cm.tab20(np.linspace(0, 1, len(track_ids)))
            
            for idx, track_id in enumerate(track_ids):
                track_data = frame_tracks[frame_tracks["track_id"] == track_id]
                color = colors[idx]
                
                for _, row in track_data.iterrows():
                    centroid_x = int(row["centroid_x"])
                    centroid_y = int(row["centroid_y"])
                    area = int(row["area"])
                    
                    # Draw circle around cluster
                    radius = int(np.sqrt(area / np.pi))
                    circle = plt.Circle(
                        (centroid_x, centroid_y),
                        radius,
                        color=color,
                        fill=False,
                        linewidth=2,
                        edgecolor=color
                    )
                    ax.add_patch(circle)
                    
                    # Add track ID text label
                    ax.text(
                        centroid_x,
                        centroid_y - radius - 5,
                        f"TID:{int(track_id)}",
                        color="white",
                        fontsize=10,
                        fontweight="bold",
                        ha="center",
                        bbox=dict(boxstyle="round,pad=0.3", facecolor=color, alpha=0.7)
                    )
        
        ax.set_title(f"Frame {frame_id + 1} - Track Assignments")
        ax.axis("off")
        
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        plt.close()
        visualizations.append(buf.getvalue())
    
    return visualizations


@app.post("/analyze-single")
async def analyze_single(file: UploadFile = File(...)) -> JSONResponse:
    if not (file.filename.endswith(".h5") or file.content_type in ("application/x-hdf", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Please upload an H5 file.")

    with tempfile.TemporaryDirectory() as tmpdir:
        h5_path = os.path.join(tmpdir, file.filename)
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file.")
        with open(h5_path, "wb") as f:
            f.write(content)

        bt_data = load_bt(h5_path)

        cold_mask = bt_data <= THRESHOLD_K
        cleaned_mask = morphology.remove_small_objects(cold_mask, min_size=MIN_AREA_PIXELS)
        cleaned_mask = morphology.remove_small_holes(cleaned_mask, area_threshold=MIN_AREA_PIXELS)

        bt_gray = normalize_to_uint8(bt_data)
        raw_img = Image.fromarray(bt_gray)
        mask_img = Image.fromarray((cleaned_mask.astype(np.uint8)) * 255)

        mask_pp = postprocess_mask(np.array(mask_img))
        blob_df = blob_props(mask_pp, bt_gray)
        blob_df["timestamp"] = os.path.splitext(file.filename)[0]
        blob_df, systems = group_dbscan(blob_df)
        systems["timestamp"] = os.path.splitext(file.filename)[0]

        # CSVs
        blobs_csv = blob_df.to_csv(index=False).encode("utf-8")
        systems_csv = systems.to_csv(index=False).encode("utf-8")
        rollup_csv = systems.to_csv(index=False).encode("utf-8")

        # Visualization
        vis_png = visualize_clusters(bt_gray, blob_df, os.path.splitext(file.filename)[0])

    response = {
        "csv_blobs_url": to_data_url(blobs_csv, "text/csv"),
        "csv_systems_url": to_data_url(systems_csv, "text/csv"),
        "csv_rollup_url": to_data_url(rollup_csv, "text/csv"),
        "cluster_png_url": to_data_url(vis_png, "image/png") if vis_png else None,
        "summary": {
          "num_systems": int(len(systems)) if not systems.empty else 0,
          "num_blobs": int(len(blob_df)) if not blob_df.empty else 0,
        },
    }
    return JSONResponse(response)


@app.post("/analyze-multi-phase2")
async def analyze_multi_phase2(files: List[UploadFile] = File(...)) -> JSONResponse:
    """
    Multi-image Phase 2: TCC Tracking across frames.
    Detects TCCs on each frame and tracks them across time with track IDs.
    """

    # Basic validation
    if len(files) < 6:
        raise HTTPException(
            status_code=400,
            detail=f"At least 6 H5 files required. Got {len(files)} files."
        )

    for f in files:
        if not (f.filename.endswith(".h5") or f.content_type in ("application/x-hdf", "application/octet-stream")):
            raise HTTPException(
                status_code=400,
                detail=f"All files must be H5. Invalid: {f.filename}"
            )

    with tempfile.TemporaryDirectory() as tmpdir:

        # Save files
        h5_paths = []
        for idx, file in enumerate(files):
            path = os.path.join(tmpdir, f"frame_{idx:03d}.h5")
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail=f"Empty file: {file.filename}")
            with open(path, "wb") as f:
                f.write(data)
            h5_paths.append((idx, path, file.filename))

        # Load all BT arrays
        bt_arrays = []
        for frame_idx, h5_path, _ in h5_paths:
            bt_data = load_bt(h5_path)
            bt_arrays.append(bt_data)

        # Check consistent shapes
        if len(set(bt.shape for bt in bt_arrays)) > 1:
            raise HTTPException(status_code=400, detail="Inconsistent spatial resolutions")

        # Perform TCC detection on all frames
        all_blob_dfs = []

        for i, bt in enumerate(bt_arrays):
            try:
                cold = bt <= THRESHOLD_K
                cold = morphology.remove_small_objects(cold, MIN_AREA_PIXELS)
                cold = morphology.remove_small_holes(cold, MIN_AREA_PIXELS)

                gray = normalize_to_uint8(bt)
                mask_pp = postprocess_mask(cold.astype(np.uint8) * 255)

                df = blob_props(mask_pp, gray)
                df["frame_id"] = i

                df.rename(
                    columns={
                        "centroid_row": "centroid_y",
                        "centroid_col": "centroid_x",
                        "pixel_count": "area"
                    },
                    inplace=True
                )

                if df.empty:
                    df = pd.DataFrame(
                        columns=["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]
                    )

                all_blob_dfs.append(
                    df[["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]]
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error detecting TCCs in frame {i}: {str(e)}"
                )

        # Perform tracking
        try:
            tracks_df = track_blobs_across_frames(all_blob_dfs)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error tracking TCCs across frames: {str(e)}"
            )

        # Generate frame visualizations with track IDs
        try:
            tracking_visualizations = visualize_tracking_with_ids(bt_arrays, all_blob_dfs, tracks_df)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error generating tracking visualizations: {str(e)}"
            )

        # Create frame results with visualizations
        frame_results = []
        for i, vis_png in enumerate(tracking_visualizations):
            frame_results.append({
                "frame_idx": i,
                "filename": h5_paths[i][2] if i < len(h5_paths) else f"frame_{i}",
                "tracking_png_url": to_data_url(vis_png, "image/png") if vis_png else None,
            })

        # Calculate track statistics
        track_stats = []
        if not tracks_df.empty:
            for track_id in tracks_df["track_id"].unique():
                track_data = tracks_df[tracks_df["track_id"] == track_id]
                track_stats.append({
                    "track_id": int(track_id),
                    "num_frames": len(track_data),
                    "start_frame": int(track_data["frame_id"].min()),
                    "end_frame": int(track_data["frame_id"].max()),
                    "mean_area": float(track_data["area"].mean()),
                    "max_area": int(track_data["area"].max()),
                    "mean_speed": float(track_data["speed"].mean()),
                })

    return JSONResponse({
        "phase": 2,
        "total_frames": len(bt_arrays),
        "frame_results": frame_results,
        "tracks_csv_url": to_data_url(tracks_df.to_csv(index=False).encode(), "text/csv"),
        "track_stats": track_stats,
    })


@app.post("/analyze-multi-phase1")
async def analyze_multi_phase1(files: List[UploadFile] = File(...)) -> JSONResponse:
    """
    Multi-image Phase 1: TCC Detection on each image independently.
    Returns detection results for each uploaded image.
    """

    # Basic validation
    if len(files) < 6:
        raise HTTPException(
            status_code=400,
            detail=f"At least 6 H5 files required. Got {len(files)} files."
        )

    for f in files:
        if not (f.filename.endswith(".h5") or f.content_type in ("application/x-hdf", "application/octet-stream")):
            raise HTTPException(
                status_code=400,
                detail=f"All files must be H5. Invalid: {f.filename}"
            )

    with tempfile.TemporaryDirectory() as tmpdir:

        # Save files
        h5_paths = []
        for idx, file in enumerate(files):
            path = os.path.join(tmpdir, f"frame_{idx:03d}.h5")
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail=f"Empty file: {file.filename}")
            with open(path, "wb") as f:
                f.write(data)
            h5_paths.append((idx, path, file.filename))

        # Process each frame independently for TCC detection
        phase1_results = []

        for frame_idx, h5_path, original_filename in h5_paths:
            try:
                # Load BT data
                bt_data = load_bt(h5_path)

                # Apply temperature threshold
                cold_mask = bt_data <= THRESHOLD_K
                cleaned_mask = morphology.remove_small_objects(cold_mask, min_size=MIN_AREA_PIXELS)
                cleaned_mask = morphology.remove_small_holes(cleaned_mask, area_threshold=MIN_AREA_PIXELS)

                # Normalize to uint8
                bt_gray = normalize_to_uint8(bt_data)

                # Post-process mask
                mask_pp = postprocess_mask(np.array(cleaned_mask.astype(np.uint8)) * 255)

                # Extract blob properties
                blob_df = blob_props(mask_pp, bt_gray)
                blob_df["timestamp"] = os.path.splitext(original_filename)[0]
                
                # Group with DBSCAN
                blob_df, systems = group_dbscan(blob_df)
                systems["timestamp"] = os.path.splitext(original_filename)[0]

                # Generate visualization
                vis_png = visualize_clusters(bt_gray, blob_df, os.path.splitext(original_filename)[0])

                # Create CSV data URLs
                blobs_csv = blob_df.to_csv(index=False).encode("utf-8")
                systems_csv = systems.to_csv(index=False).encode("utf-8")

                phase1_results.append({
                    "frame_idx": frame_idx,
                    "filename": original_filename,
                    "csv_blobs_url": to_data_url(blobs_csv, "text/csv"),
                    "csv_systems_url": to_data_url(systems_csv, "text/csv"),
                    "cluster_png_url": to_data_url(vis_png, "image/png") if vis_png else None,
                    "summary": {
                        "num_systems": int(len(systems)) if not systems.empty else 0,
                        "num_blobs": int(len(blob_df)) if not blob_df.empty else 0,
                    }
                })
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error processing frame {frame_idx} ({original_filename}): {str(e)}"
                )

    return JSONResponse({
        "phase": 1,
        "total_frames": len(files),
        "results": phase1_results
    })


@app.post("/analyze-multi-phase3")
async def analyze_multi_phase3(files: List[UploadFile] = File(...)) -> JSONResponse:
    """
    Multi-image Phase 3: Cyclogenesis Prediction using ConvLSTM + Rule-based detection.
    Predicts next frame and identifies cyclone-prone tracks.
    """

    # Basic validation
    if len(files) < 6:
        raise HTTPException(
            status_code=400,
            detail=f"At least 6 H5 files required. Got {len(files)} files."
        )

    for f in files:
        if not (f.filename.endswith(".h5") or f.content_type in ("application/x-hdf", "application/octet-stream")):
            raise HTTPException(
                status_code=400,
                detail=f"All files must be H5. Invalid: {f.filename}"
            )

    with tempfile.TemporaryDirectory() as tmpdir:

        # Save files
        h5_paths = []
        for idx, file in enumerate(files):
            path = os.path.join(tmpdir, f"frame_{idx:03d}.h5")
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail=f"Empty file: {file.filename}")
            with open(path, "wb") as f:
                f.write(data)
            h5_paths.append(path)

        # Load BT arrays
        bt_arrays = [load_bt(p) for p in h5_paths]

        if len(set(bt.shape for bt in bt_arrays)) > 1:
            raise HTTPException(status_code=400, detail="Inconsistent spatial resolutions")

        # ConvLSTM input - use first 5 frames
        input_frames = [preprocess_for_convlstm(bt) for bt in bt_arrays[:5]]
        input_sequence = np.stack(input_frames, axis=0)

        model = load_convlstm_model(CONVLSTM_MODEL_PATH)
        predicted_mask_256 = predict_next_frame(model, input_sequence)

        # Resize predicted mask back to original BT resolution
        h, w = bt_arrays[-1].shape
        predicted_mask = np.array(
            Image.fromarray(predicted_mask_256).resize((w, h), resample=Image.BILINEAR)
        )

        # Blob detection on all observed frames
        all_blob_dfs = []

        for i, bt in enumerate(bt_arrays):
            cold = bt <= THRESHOLD_K
            cold = morphology.remove_small_objects(cold, MIN_AREA_PIXELS)
            cold = morphology.remove_small_holes(cold, MIN_AREA_PIXELS)

            gray = normalize_to_uint8(bt)
            mask_pp = postprocess_mask(cold.astype(np.uint8) * 255)

            df = blob_props(mask_pp, gray)
            df["frame_id"] = i

            df.rename(
                columns={
                    "centroid_row": "centroid_y",
                    "centroid_col": "centroid_x",
                    "pixel_count": "area"
                },
                inplace=True
            )

            if df.empty:
                df = pd.DataFrame(
                    columns=["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]
                )

            all_blob_dfs.append(
                df[["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]]
            )

        # Predicted frame blobs
        pred_df = detect_tcc_blobs(predicted_mask)
        pred_df["frame_id"] = len(bt_arrays)

        all_blob_dfs.append(
            pred_df[["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]]
        )

        # Tracking and cyclogenesis prediction
        tracks_df = track_blobs_across_frames(all_blob_dfs)
        cyclogenesis_df = predict_cyclogenesis(tracks_df)

        # Create overlay visualization on the last observed frame (Frame 6 / index 5)
        last_frame_id = len(bt_arrays) - 1
        overlay_png = create_overlay_visualization(
            normalize_to_uint8(bt_arrays[-1]),
            tracks_df,
            cyclogenesis_df,
            last_frame_id
        )

        # Create predicted next frame visualization for reference
        pred_vis_png = None
        try:
            fig, ax = plt.subplots(figsize=(8, 8))
            ax.imshow(normalize_to_uint8(predicted_mask), cmap="gray")
            ax.set_title("ConvLSTM Predicted Next Frame")
            ax.axis("off")
            buf = io.BytesIO()
            plt.tight_layout()
            plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
            plt.close()
            pred_vis_png = buf.getvalue()
        except Exception as e:
            print(f"Warning: Could not create predicted frame visualization: {e}")

        # Get cyclone-prone track details
        cyclone_prone_tracks = cyclogenesis_df.query("cyclogenesis == 1")
        cyclone_prone_track_details = []
        
        if not cyclone_prone_tracks.empty:
            for _, track in cyclone_prone_tracks.iterrows():
                track_id = track["track_id"]
                track_data = tracks_df[tracks_df["track_id"] == track_id]
                
                cyclone_prone_track_details.append({
                    "track_id": int(track_id),
                    "reason": track["reason"],
                    "persistence_frames": len(track_data),
                    "mean_speed": float(track_data["speed"].mean()),
                    "max_area": int(track_data["area"].max()),
                    "mean_area": float(track_data["area"].mean()),
                })

    return JSONResponse({
        "phase": 3,
        "overlay_url": to_data_url(overlay_png, "image/png"),
        "predicted_frame_url": to_data_url(pred_vis_png, "image/png") if pred_vis_png else None,
        "csv_tracks_url": to_data_url(tracks_df.to_csv(index=False).encode(), "text/csv"),
        "csv_cyclogenesis_url": to_data_url(cyclogenesis_df.to_csv(index=False).encode(), "text/csv"),
        "cyclone_prone_track_ids": cyclone_prone_tracks["track_id"].tolist(),
        "cyclone_prone_track_details": cyclone_prone_track_details,
        "total_tracks": len(cyclogenesis_df),
        "cyclone_prone_count": len(cyclone_prone_tracks),
    })


@app.post("/analyze-multi")
async def analyze_multi(files: List[UploadFile] = File(...)) -> JSONResponse:
    """
    Multi-image tracking endpoint.
    """

    # Basic validation
    if len(files) < 6:
        raise HTTPException(
            status_code=400,
            detail=f"At least 6 H5 files required. Got {len(files)} files."
        )

    for f in files:
        if not (f.filename.endswith(".h5") or f.content_type in ("application/x-hdf", "application/octet-stream")):
            raise HTTPException(
                status_code=400,
                detail=f"All files must be H5. Invalid: {f.filename}"
            )

    with tempfile.TemporaryDirectory() as tmpdir:

        # Save files
        h5_paths = []
        for idx, file in enumerate(files):
            path = os.path.join(tmpdir, f"frame_{idx:03d}.h5")
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail=f"Empty file: {file.filename}")
            with open(path, "wb") as f:
                f.write(data)
            h5_paths.append(path)

        # Load BT arrays
        bt_arrays = [load_bt(p) for p in h5_paths]

        if len(set(bt.shape for bt in bt_arrays)) > 1:
            raise HTTPException(status_code=400, detail="Inconsistent spatial resolutions")

        # ConvLSTM input
        input_frames = [preprocess_for_convlstm(bt) for bt in bt_arrays[:5]]
        input_sequence = np.stack(input_frames, axis=0)

        model = load_convlstm_model(CONVLSTM_MODEL_PATH)
        predicted_mask_256 = predict_next_frame(model, input_sequence)

    # Resize predicted mask back to original BT resolution
    h, w = bt_arrays[-1].shape
    predicted_mask = np.array(
    Image.fromarray(predicted_mask_256).resize((w, h), resample=Image.BILINEAR)
    )


    # Blob detection
    all_blob_dfs = []

    for i, bt in enumerate(bt_arrays):
        cold = bt <= THRESHOLD_K
        cold = morphology.remove_small_objects(cold, MIN_AREA_PIXELS)
        cold = morphology.remove_small_holes(cold, MIN_AREA_PIXELS)

        gray = normalize_to_uint8(bt)
        mask_pp = postprocess_mask(cold.astype(np.uint8) * 255)

        df = blob_props(mask_pp, gray)
        df["frame_id"] = i

        df.rename(
            columns={
                "centroid_row": "centroid_y",
                "centroid_col": "centroid_x",
                "pixel_count": "area"
            },
            inplace=True
        )

        if df.empty:
            df = pd.DataFrame(
                columns=["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]
            )

        all_blob_dfs.append(
            df[["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]]
        )

    # Predicted frame blobs
    pred_df = detect_tcc_blobs(predicted_mask)
    pred_df["frame_id"] = len(bt_arrays)

    all_blob_dfs.append(
        pred_df[["frame_id", "blob_id", "area", "centroid_x", "centroid_y"]]
    )

    tracks_df = track_blobs_across_frames(all_blob_dfs)
    cyclogenesis_df = predict_cyclogenesis(tracks_df)

    last_frame_id = len(bt_arrays) - 1
    overlay_png = create_overlay_visualization(
        normalize_to_uint8(bt_arrays[-1]),
        tracks_df,
        cyclogenesis_df,
        last_frame_id
    )

    return JSONResponse({
        "overlay_url": to_data_url(overlay_png, "image/png"),
        "csv_tracks_url": to_data_url(tracks_df.to_csv(index=False).encode(), "text/csv"),
        "csv_cyclogenesis_url": to_data_url(cyclogenesis_df.to_csv(index=False).encode(), "text/csv"),
        "cyclone_prone_track_ids": cyclogenesis_df.query("cyclogenesis == 1")["track_id"].tolist()
    })


