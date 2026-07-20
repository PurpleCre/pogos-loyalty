# Overview

Loyalty app for a restaraunt written in React with Capacitor conversion and Android Studio.

The app is designed to show useres promotions and to mainly track their purchases while also rewarding them at key moments. The app uses google qr scanner to scan receipts and award points for each purchase. To use the app, open it, create an account or login, tap scan qr and scan the code (Which you wont have for now). You can also browse the other functions.

The app is meant to reward loyal customers which free meals at certain milestones, while also collecting data to enhance the service offered by the restaurant.

[Restaurant Loyalty App Demo](https://youtu.be/VhCDScEzQW0)

# Development Environment

I used React to build a mobile first webapp, then I converted it to an android app using capicator through vscode, finally I made improvements and intergrations in android studio before shipping a release version of the app.

I used React with capacitor, then kotlin and java for the entire project.

# Useful Websites

* [capacitorjs.com](https://capacitorjs.com/solution/react)
* [developer.android.com](https://developer.android.com/develop)

# Future Work (Production Readiness)

*   **Payment Processing:** Integrate a legitimate Payment Gateway (e.g., Stripe, Paynow) to process online transactions securely, or implement SMS OTP for cash-on-delivery validation.
*   **Push Notifications:** Store Expo push tokens in the database and create a backend trigger to notify users when order statuses change.
*   **Backend Security (Edge Functions):** Move sensitive operations (order total calculation, loyalty points awarding) off the client and into secure Supabase Edge Functions.
*   **Crash Reporting & Analytics:** Properly configure Sentry with DSN and Project IDs for production crash reporting.
*   **App Store Compliance:** Add an in-app "Delete Account" button and link to a Privacy Policy to comply with Apple and Google app store requirements.
*   **Email Branding:** Customize Supabase authentication emails (Confirmation, Password Reset) with the Pogo's brand and logo.
*   **Automated Testing:** Add E2E tests (Jest/Maestro) for critical user paths to ensure OTA updates don't break the main flow.
*   **Points Sharing:** Implement a feature that allows users to securely transfer or gift loyalty points to their friends and family.

# Release

[pogosloyalty.apk](https://github.com/PurpleCre/pogos-loyalty-buzz/blob/main/android/app/release/baselineProfiles/0/app-release.dm)
