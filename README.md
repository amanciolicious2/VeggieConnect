# VeggieConnect - Connecting Filipino Farmers and Suppliers to Local Communities

*A modern agricultural application that bridges farmers and consumers in Bogo City, Cebu.*

[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com)
[![Dart](https://img.shields.io/badge/Dart-0175C2?style=for-the-badge&logo=dart&logoColor=white)](https://dart.dev)
[![NodeJS](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white)](https://dart.dev)
[![VERCEL](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://dart.dev)

## About the Project

VeggieConnect is a comprehensive agricultural application built for the farmers, suppliers, and customers of Bogo City. This platform connects local producers with their community through modern technology.

**Mission:** Make fresh vegetables and farm products more accessible through direct connections with farmers and suppliers, while promoting sustainable agriculture in Bogo City.

## Key Features

### Multi-Role System

- **Customer Dashboard** - For buyers and consumers
- **Supplier Dashboard** - For sellers and vendors
- **Admin Dashboard** - For system management

### Core Functionality

- **Real-time Product Listings** - Live product updates with high-quality images
- **Cash-on-Pickup System** - Pay upon personal collection
- **Online Payment Integration** - PayMongo GCash, Maya and card payments
- **Location-based Services** - Find nearby suppliers and farms
- **Real-time Chat System** - Direct communication with suppliers
- **Order Management** - Complete order tracking system
- **Rating & Review System** - Quality assurance mechanism

### Location Features

- **Farm Location Mapping** - Interactive maps of farming areas
- **Supplier Location Management** - Manage multiple pickup locations
- **Distance-based Filtering** - Find the nearest available options
- **Navigation Integration** - Direct navigation to pickup locations

## Tech Stack

### Frontend

- **Flutter 3.9.0+** - Cross-platform mobile development
- **Dart** - Programming language
- **Google Fonts** - Modern typography (Quicksand, Inter)

### Backend & Services

- **Firebase Suite:**
  - Firestore - Real-time database
  - Authentication - User management/EmailJS via Pin Verification
  - Cloud Functions - Server-side logic
  - Cloud Messaging - Push notifications
  - Storage - Cloud Firestore
- **Node.js** - Cloud Functions runtime

### Third-party Integrations

- **Cloudinary** - Image storage and optimization
- **PayMongo** - Payment processing (GCash, Maya, Cards)
- **OpenStreetMap** - Mapping services (flutter_map)
- **Geolocator** - Location services
- **Vercel** - Hosting and deploying PayMongo online payment webhooks for seamless payment integration
- **Github Pages** - Hosting and deploying PayMongo online payment success and cancellation pages, including deep links to redirect users back to the application.

## Setup Instructions

### Prerequisites

Ensure you have the following installed:

- [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.9.0 or higher)
- [Android Studio](https://developer.android.com/studio) or [VS Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/) (18.0 or higher) - for Firebase Functions
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/VeggieConnect.git
cd VeggieConnect/veggieconnect
```

### 2. Environment Configuration

**IMPORTANT: Set up environment variables before running the app**

#### Copy Environment Template

```bash
cp .env.example .env
```

#### Configure Your Credentials

Open `.env` and replace placeholder values with your actual credentials:

```bash
# Firebase Configuration
FIREBASE_API_KEY=your_actual_firebase_api_key
FIREBASE_PROJECT_ID=your_project_id
# ... (see .env.example for all required variables)

# Cloudinary Configuration  
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# PayMongo Configuration
PAYMONGO_SECRET_KEY=sk_test_your_secret_key
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key
```

> **Security Warning**: Never commit `.env` files to version control. The `.gitignore` file is configured to prevent this.

### 3. Install Dependencies

```bash
# Flutter dependencies
flutter pub get

# Firebase Functions dependencies
cd functions
npm install
cd ..
```

### 4. Service Configuration

#### Firebase Setup

1. Create a new Firebase project in [Firebase Console](https://console.firebase.google.com)
2. Enable the following services:
   - Authentication (Email/Password)
   - Firestore Database
   - Cloud Storage
   - Cloud Functions
   - Cloud Messaging
3. Download `google-services.json` and place it in `android/app/`
4. Update your `.env` file with Firebase configuration values

#### Cloudinary Setup

1. Sign up for [Cloudinary](https://cloudinary.com)
2. Create upload presets:
   - `VeggieConnectAvatar` for profile images
   - `VeggieConnectProducts` for product images
3. Update `.env` with your Cloudinary credentials

#### PayMongo Configuration

1. Sign up for [PayMongo](https://paymongo.com)
2. Get your test API keys from Developers > API Keys
3. Set up webhook endpoints for payment notifications
4. Update `.env` with PayMongo credentials

### 5. Verify Configuration

```bash
# Check that .env is not tracked by git
git status

# Verify Flutter dependencies
flutter doctor

# Test Firebase connection
flutter run --debug
```

### 6. Run the Application

```bash
# Check available devices
flutter devices

# Run in development mode
flutter run

# Build for release
flutter build apk --release
```

## Security & Environment Management

### Environment Files

- **`.env`** - Your actual credentials (NEVER commit this)
- **`.env.example`** - Template for other developers (safe to commit)
- **`SECURITY.md`** - Detailed security guidelines

### Security Best Practices

- All sensitive data is stored in environment variables
- Production and development use separate credentials
- API keys are restricted to specific domains/IPs
- Regular credential rotation schedule implemented

### For Team Members

1. Copy `.env.example` to `.env`
2. Request credentials from team lead
3. Follow security guidelines in `SECURITY.md`
4. Never share credentials in chat or email

## Application Usage

### For Customers

1. **Register** - Create an account using Gmail with PIN verification through EmailJS
2. **Browse Products** - View available vegetables and farm products
3. **Add to Cart** - Add products to shopping cart
4. **Choose Payment** - Select cash-on-pickup or online payment
5. **Track Order** - Monitor order status and progress
6. **Rate & Review** - Provide feedback after transaction

### For Suppliers

1. **Setup Profile** - Complete business information
2. **Add Products** - Upload products with photos and descriptions
3. **Manage Inventory** - Update stock levels regularly
4. **Process Orders** - Handle incoming orders efficiently
5. **Location Management** - Set up pickup locations
6. **Customer Communication** - Chat with customers directly

### For Admins

1. **User Management** - Manage customer and supplier accounts
2. **Product Verification** - Approve or reject product listings
3. **Analytics Dashboard** - Monitor platform performance
4. **Farm Location Approval** - Approve farm location requests
5. **Reports Generation** - Generate business reports

## Project Structure

```
lib/
├── admin-side/          # Admin dashboard and management
├── authentication/      # Login, signup, verification
├── customer-side/       # Customer app features
├── supplier-side/       # Supplier dashboard and tools
├── services/            # Business logic and API calls
├── models/              # Data models
├── widgets/             # Reusable UI components
├── config/              # Configuration files
├── utils/               # Helper functions
└── main.dart            # App entry point

functions/             # Firebase Cloud Functions
assets/                # Images, fonts, animations
android/               # Android-specific configuration
ios/                   # iOS-specific configuration
paymongo-api/          # PayMongo integration APIs
.env                   # Environment variables (not committed)
.env.example           # Environment template (committed)
SECURITY.md            # Security guidelines
```

### Coding Standards

- **Naming Convention:** camelCase for variables, PascalCase for classes
- **File Organization:** Group related files in appropriate folders
- **Documentation:** Add comments for complex business logic
- **Error Handling:** Always handle potential errors gracefully
- **Security:** Never hardcode credentials, always use environment variables

### Testing

```bash
# Run unit tests
flutter test

# Run integration tests
flutter drive --target=test_driver/app.dart

# Test with different environments
flutter run --dart-define=ENVIRONMENT=development
```

## Deployment

### Environment Setup

Before deploying, ensure you have:

- Production environment variables configured
- Separate Firebase project for production
- Production PayMongo account with live keys
- Production Cloudinary account

### Android Release

```bash
# Generate signed APK
flutter build apk --release --dart-define=ENVIRONMENT=production

# Generate App Bundle (recommended)
flutter build appbundle --release --dart-define=ENVIRONMENT=production
```

### Firebase Functions

```bash
cd functions
firebase use production  # Switch to production project
firebase deploy --only functions
```

## 🔒 Security Analysis

For comprehensive security assessment and vulnerability analysis, see:

- **[SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md)** - Detailed security vulnerabilities and solutions
- **[SECURITY.md](SECURITY.md)** - Security guidelines and best practices

### Key Security Findings

- **10 Critical Security Vulnerabilities** identified and documented
- **Risk-based prioritization** with immediate, short-term, and long-term solutions
- **Industry-standard security practices** implementation roadmap
- **Capstone defense ready** security analysis with talking points

### Security Implementation Status

- ✅ Security vulnerability assessment completed
- ✅ Risk matrix and prioritization established  
- ✅ Remediation roadmap documented
- 🔄 Security fixes implementation (in progress)
- 🔄 Security testing automation (planned)

### Environment Variables for Production

Set up production environment variables:

- Firebase production config
- PayMongo live API keys
- Cloudinary production credentials
- Production webhook URLs
- EmailJS production API keys

### Deployment Checklist

- [ ] Production `.env` file configured
- [ ] All API keys are production-ready
- [ ] Firebase security rules updated
- [ ] PayMongo webhooks configured
- [ ] Cloudinary upload presets created
- [ ] App signing keys secured
- [ ] Error monitoring enabled

## Contributing

Thank you for your interest in VeggieConnect! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Set up your development environment (copy `.env.example` to `.env`)
4. Make your changes following our coding standards
5. Test thoroughly with your environment
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Setup for Contributors

1. Follow the setup instructions above
2. Request access to development credentials
3. Read `SECURITY.md` for security guidelines
4. Test all features before submitting PR
5. Ensure no breaking changes are introduced
6. Never commit `.env` files or credentials

## License

Distributed under the MIT License. See `LICENSE` file for more information.

## Contact & Support

**Developer:** Team VeggieConnect
**Email:** N/A
**Security:** N/A
**Facebook:** [VeggieConnect Bogo City, Cebu](N/A)

### For Technical Issues

1. Check existing issues on GitHub
2. Create a detailed bug report
3. Include device information and error logs
4. **Never include credentials in issue reports**

### For Business Inquiries

- Partnership opportunities
- Feature requests
- Commercial licensing

## Acknowledgments

<!-- Thanks to everyone who contributed to this project:
- Local farmers who provided valuable feedback
- Beta testers from various communities
- Open source community for tools and libraries
- Firebase team for excellent backend services
- Security researchers who helped improve our practices -->

---

**Created with ❤️ for the farming and supply community of Bogo City, Cebu**

"Bringing suppliers closer to families, one fresh harvest at a time"

## Additional Documentation

- [`SECURITY.md`](./SECURITY.md) - Security guidelines and best practices
- [`.env.example`](./.env.example) - Environment configuration template
- [Firebase Documentation](https://firebase.google.com/docs)
- [Flutter Documentation](https://flutter.dev/docs)
