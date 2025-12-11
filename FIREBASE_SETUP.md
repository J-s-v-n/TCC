# Firebase Authentication Setup Guide

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get Started**
3. Enable **Email/Password** authentication method
4. Enable **Google** authentication method:
   - Click on the **Google** provider
   - Toggle it to **Enabled**
   - Enter your project support email (this will be used as the sender email)
   - Click **Save**
5. Click **Save** for Email/Password method as well

## Step 2.5: Enable Firebase Storage

1. In your Firebase project, go to **Storage** in the left sidebar
2. Click **Get Started**
3. Choose **Start in test mode** (for development) or **Start in production mode** (for production)
4. Select a Cloud Storage location (choose the closest to your users)
5. Click **Done**

**Important:** For production, make sure to set up proper Security Rules:
- Go to **Storage** → **Rules**
- Update rules to allow authenticated users to upload:

**For Development/Testing (less secure, allows all authenticated users):**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tcc-images/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**For Production (more secure, user-specific):**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tcc-images/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**⚠️ Troubleshooting Upload Issues:**
If uploads are stuck at 0% or failing:
1. **Check Storage Rules**: Make sure Storage rules allow authenticated users to write
2. **Check Browser Console**: Open browser DevTools (F12) → Console tab to see detailed error messages
3. **Verify Authentication**: Make sure you're signed in (check the header for your email/name)
4. **Check Network Tab**: In DevTools → Network tab, look for failed requests to Firebase Storage
5. **Test Mode**: If using test mode, make sure it hasn't expired (test mode expires after 30 days)
6. **File Size**: Very large files (>100MB) may timeout - try smaller images first

## Step 2.6: Enable Realtime Database

1. In your Firebase project, go to **Realtime Database** in the left sidebar
2. Click **Create Database**
3. Choose **Start in test mode** (for development) or **Start in production mode** (for production)
4. Select a database location (choose the closest to your users)
5. Click **Done**

**Important:** For production, make sure to set up proper Security Rules:
- Go to **Realtime Database** → **Rules**
- Update rules to allow authenticated users to read/write their own data:
```
{
  "rules": {
    "tcc-uploads": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "$userId === auth.uid"
      }
    }
  }
}
```

**Note:** Copy your Realtime Database URL from the Firebase Console (it looks like `https://your-project-default-rtdb.firebaseio.com/`) and add it to your Firebase config as `databaseURL`.

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to **Your apps** section
4. Click the **Web** icon (`</>`) to add a web app
5. Register your app (you can use any app nickname)
6. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root of your project (same level as `package.json`)
2. Add your Firebase configuration values:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

Replace the placeholder values with your actual Firebase config values.

## Step 5: Restart Your Dev Server

After creating/updating the `.env` file, restart your development server:

```bash
npm run dev
```

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- Firebase API keys in web apps are safe to expose (they're restricted by domain)

## Testing Authentication

1. Navigate to `/signup` to create a new account:
   - You can sign up with email/password
   - Or click "Sign up with Google" to use your Google account
2. Navigate to `/login` to sign in:
   - Sign in with email/password
   - Or click "Sign in with Google" to use your Google account
3. Once signed in, you'll see your name/email in the header
4. Click "Sign Out" to log out

## Testing Image Upload

1. Navigate to `/tools` page
2. Sign in if you haven't already
3. Click on the upload area or drag & drop images
4. Supported formats: PNG, JPG, TIFF
5. For single image detection: upload 1 image
6. For multi-image tracking: upload 3-10 images
7. Images will be uploaded to Firebase Storage
8. Image metadata will be stored in Firebase Realtime Database under `tcc-uploads/{userId}/`

## Google Sign-In Setup Notes

- Google sign-in will automatically create an account if one doesn't exist
- Users can sign in with Google even if they previously signed up with email/password (Firebase handles account linking)
- Make sure your project support email is set correctly in Firebase Console

