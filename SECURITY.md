# 🔒 Security Guidelines for VeggieConnect

## Environment Variables & Credentials Management

### 🚨 Critical Security Rules

1. **NEVER commit `.env` files to version control**
2. **NEVER hardcode API keys, secrets, or credentials in source code**
3. **Always use environment variables for sensitive configuration**
4. **Regularly rotate API keys and secrets**
5. **Use different credentials for development, staging, and production**

### 📁 Environment Files Setup

#### 1. Copy the Template
```bash
cp .env.example .env
```

#### 2. Fill in Your Actual Values
Replace all placeholder values in `.env` with your real credentials:

```bash
# ❌ DON'T use placeholder values
FIREBASE_API_KEY=your_firebase_api_key_here

# ✅ DO use actual values
FIREBASE_API_KEY=AIzaSyDQQoWOIpRRe2tVISTfPHLZZZYlEZSPAoM
```

#### 3. Verify .gitignore
Ensure `.env` is listed in `.gitignore`:
```gitignore
# Environment variables (NEVER commit these)
.env
.env.local
.env.development
.env.production
.env.test
```

### 🔑 Credential Sources

#### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings > General > Your apps
4. Copy the configuration values

#### Cloudinary Setup
1. Sign up at [Cloudinary](https://cloudinary.com)
2. Go to Dashboard
3. Copy Cloud name, API Key, and API Secret
4. Create upload presets in Settings > Upload

#### PayMongo Configuration
1. Sign up at [PayMongo](https://paymongo.com)
2. Go to Developers > API Keys
3. Copy Secret Key and Public Key
4. Set up webhooks for payment notifications

### 🛡️ Security Best Practices

#### For Development
- Use test/sandbox credentials only
- Never use production keys in development
- Set `PAYMENT_TEST_MODE=true` for testing

#### For Production
- Use production credentials
- Enable all security features
- Set `NODE_ENV=production`
- Use strong, unique passwords and secrets

#### Key Rotation Schedule
- **Firebase**: Rotate annually or if compromised
- **PayMongo**: Rotate quarterly
- **Cloudinary**: Rotate bi-annually
- **JWT Secrets**: Rotate monthly

### 🚫 What NOT to Do

```dart
// ❌ NEVER hardcode credentials
class BadExample {
  static const String apiKey = "AIzaSyDQQoWOIpRRe2tVISTfPHLZZZYlEZSPAoM";
  static const String secret = "sk_test_123456789";
}

// ❌ NEVER commit .env files
git add .env  // DON'T DO THIS!
```

### ✅ What TO Do

```dart
// ✅ Use environment variables
class GoodExample {
  static String get apiKey => Platform.environment['FIREBASE_API_KEY'] ?? '';
  static String get secret => Platform.environment['PAYMONGO_SECRET'] ?? '';
}

// ✅ Use configuration classes
import '../config/firebase_config.dart';
import '../config/cloudinary_config.dart';
```

### 🔍 Security Checklist

Before deploying:

- [ ] All `.env` files are in `.gitignore`
- [ ] No hardcoded credentials in source code
- [ ] Production credentials are different from development
- [ ] All API keys have proper restrictions/scopes
- [ ] Webhook endpoints use signature verification
- [ ] HTTPS is enforced for all external communications
- [ ] Rate limiting is configured
- [ ] Error messages don't expose sensitive information

### 🚨 If Credentials Are Compromised

1. **Immediately rotate the compromised credentials**
2. **Update all deployment environments**
3. **Check logs for unauthorized access**
4. **Notify team members**
5. **Review and update security practices**

### 📞 Security Contact

For security-related issues:
- **Email**: security@veggieconnect.ph
- **Response Time**: Within 24 hours
- **Severity Levels**: Critical, High, Medium, Low

### 🔗 Additional Resources

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [PayMongo Security Best Practices](https://developers.paymongo.com/docs/security)
- [Cloudinary Security Features](https://cloudinary.com/documentation/security)
- [Flutter Security Guidelines](https://flutter.dev/docs/deployment/security)

---

**Remember: Security is everyone's responsibility. When in doubt, ask the team!**
