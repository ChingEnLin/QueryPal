# QueryPal Frontend - Enterprise Edition

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/ChingEnLin/QueryPal&dir=frontend)

The QueryPal frontend is a modern, enterprise-ready React application that provides an intuitive interface for AI-powered database exploration and management. Built with TypeScript, Vite, and cutting-edge web technologies, it offers a secure, responsive, and collaborative experience for working with Azure Cosmos DB.

## 🌟 Key Features

- 🧠 **AI-Powered Query Interface**: Natural language to MongoDB query conversion with real-time suggestions
- 📊 **Interactive Data Analysis**: AI-generated insights with dynamic Chart.js visualizations  
- 💾 **Collaborative Query Management**: Save, share, and organize queries with team members
- 🔍 **Advanced Data Explorer**: Paginated document browsing with intelligent filtering and search
- 📝 **Document Management**: Full CRUD operations with audit trails and history tracking
- 🔒 **Enterprise Security**: Microsoft Entra ID authentication with secure token handling
- 🎨 **Modern UI/UX**: Responsive design with dark/light themes and accessibility compliance
- 🎓 **Interactive Onboarding**: Guided tutorials for new users and feature discovery

## 🏗️ Architecture Overview

QueryPal follows a **Backend-for-Frontend (BFF)** security pattern where the React frontend never handles sensitive credentials or makes direct calls to cloud management APIs. All secure operations are delegated to the backend API.

### 🔐 Authentication Flow

1. **Frontend Authentication**: User signs in using MSAL.js with Azure Entra ID
2. **Secure API Communication**: All backend calls include validated access tokens
3. **Token Management**: Automatic token refresh and secure storage
4. **Backend Verification**: Every API request is validated server-side
5. **On-Behalf-Of Flow**: Backend uses OBO to access Azure resources securely

This architecture ensures **zero-trust security** - no database credentials or cloud management tokens are ever exposed to the browser.

---

## 🛠️ Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | React | 18.2+ | Modern UI library with hooks |
| **Language** | TypeScript | 5.7+ | Type-safe JavaScript development |
| **Build Tool** | Vite | 6.2+ | Fast development and optimized builds |
| **Styling** | Tailwind CSS | Latest | Utility-first CSS framework |
| **UI Components** | Material-UI | 7.2+ | Professional React components |
| **Charts** | Chart.js + React | 4.5+ | Interactive data visualizations |
| **Authentication** | MSAL Browser | 3.10+ | Microsoft identity platform |
| **Routing** | React Router | 7.8+ | Client-side navigation |
| **Code Editor** | Monaco Editor | 4.7+ | In-browser code editing |
| **Testing** | Vitest + RTL | 3.2+ | Fast testing framework |
| **JSON Display** | React JSON View | 2.4+ | Interactive JSON visualization |

### 🎨 UI/UX Features

- **🌙 Dark/Light Themes**: Automatic system preference detection with manual toggle
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **♿ Accessibility**: WCAG 2.1 AA compliant with screen reader support
- **🎯 Interactive Elements**: Hover states, loading indicators, and smooth animations
- **🧭 Navigation**: Intuitive breadcrumbs and contextual navigation
- **⌨️ Keyboard Support**: Full keyboard navigation and shortcuts

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20+ (LTS recommended)
- **npm** or **yarn** package manager
- **Azure Entra ID Application** configured for SPA
- **Backend API** running (see [backend README](../backend/README.md))

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/ChingEnLin/QueryPal
cd QueryPal/frontend

# 2. Install dependencies
npm install

# 3. Configure authentication
cp authConfig.example.ts authConfig.ts
# Edit authConfig.ts with your Azure app details

# 4. Configure API endpoint
cp config.example.ts config.ts
# Set your backend API URL

# 5. Start development server
npm run dev

# Application will be available at http://localhost:5173
```

### Environment Configuration

#### Authentication Setup (`authConfig.ts`)

```typescript
export const msalConfig = {
  auth: {
    clientId: "your-frontend-client-id",
    authority: "https://login.microsoftonline.com/your-tenant-id",
    redirectUri: "http://localhost:5173" // or your production URL
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  }
};

export const loginRequest = {
  scopes: [
    "User.Read",
    "api://your-backend-client-id/access_as_user"
  ]
};
```

#### API Configuration (`config.ts`)

```typescript
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-api.com'
  : 'http://localhost:8000';

export const USE_MSAL_AUTH = true; // Set to false for development mode
```

### Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

---

## 🏗️ Project Structure

```
frontend/
├── public/                         # Static assets
├── src/                           # Source code
│   ├── components/                # Reusable UI components
│   │   ├── icons/                # Icon components
│   │   ├── Loader.tsx            # Loading indicators
│   │   ├── QueryResult.tsx       # Query result display
│   │   ├── SavedQueriesPanel.tsx # Query management
│   │   ├── AnalysisResultDisplay.tsx # AI analysis UI
│   │   ├── DocumentEditor.tsx    # Document editing
│   │   └── Tutorial.tsx          # Interactive onboarding
│   ├── pages/                    # Page components
│   │   ├── QueryGeneratorPage.tsx # Main query interface
│   │   ├── DataExplorerPage.tsx  # Data browsing
│   │   └── LandingPage.tsx       # Welcome screen
│   ├── services/                 # API and business logic
│   │   ├── dbService.ts          # Database operations
│   │   ├── geminiService.ts      # AI query processing
│   │   ├── userDataService.ts    # User data management
│   │   └── mockData.ts           # Development data
│   ├── contexts/                 # React contexts
│   │   ├── ThemeContext.tsx      # Theme management
│   │   └── AuthContext.tsx       # Authentication state
│   ├── utils/                    # Utility functions
│   │   ├── schemaUtils.ts        # Schema processing
│   │   ├── formatters.ts         # Data formatting
│   │   └── validation.ts         # Input validation
│   ├── types.ts                  # TypeScript type definitions
│   ├── authConfig.ts             # MSAL configuration
│   ├── config.ts                 # Application configuration
│   ├── router.tsx                # Application routing
│   └── App.tsx                   # Main application component
├── __tests__/                    # Test suites
├── docs/                         # Documentation
├── coverage/                     # Test coverage reports
├── dist/                         # Production build output
├── package.json                  # Dependencies and scripts
├── vite.config.ts               # Vite configuration
├── vitest.config.ts             # Test configuration
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── Dockerfile                   # Container configuration
└── README.md                    # This documentation
```

### 🏛️ Architectural Patterns

- **📦 Component-Based Architecture**: Modular, reusable UI components
- **🎯 Context-Based State Management**: React Context for global state
- **🔄 Service Layer Pattern**: Abstracted API interactions
- **🛡️ Type-Safe Development**: Comprehensive TypeScript usage
- **📱 Mobile-First Design**: Responsive design principles

---

## 🎨 UI Components & Styling

### Design System

QueryPal uses a consistent design system built on:

- **🎨 Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **📐 Material Design**: Professional UI components from Material-UI
- **🌈 Color Palette**: Carefully selected colors optimized for accessibility
- **📝 Typography**: Clear, readable font hierarchy
- **🔲 Spacing System**: Consistent spacing using Tailwind's scale

### Theme System

```typescript
// Dark/Light theme support
const ThemeContext = createContext({
  theme: 'light' | 'dark',
  toggleTheme: () => {},
  systemPreference: 'light' | 'dark'
});

// Usage in components
const { theme, toggleTheme } = useTheme();
```

### Key UI Components

- **🔍 QueryResult**: Advanced data display with pagination and filtering
- **📊 AnalysisResultDisplay**: AI insights with interactive Chart.js visualizations
- **💾 SavedQueriesPanel**: Query management with sharing capabilities
- **📝 DocumentEditor**: Rich document editing with validation
- **🎓 Tutorial**: Interactive guided onboarding system
- **🔄 Loader**: Consistent loading states throughout the app

### Responsive Design

```css
/* Mobile-first responsive classes */
.container {
  @apply px-4 md:px-6 lg:px-8;
  @apply max-w-sm md:max-w-4xl lg:max-w-6xl;
}

/* Dark mode support */
.card {
  @apply bg-white dark:bg-slate-800;
  @apply border-slate-200 dark:border-slate-700;
}
```

---

## 🧪 Testing & Quality

QueryPal frontend maintains high code quality with comprehensive testing and modern development practices.

### Test Suites

#### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode for development
npm run test:watch

# Run tests once and exit (CI/CD)
npm run test:run

# Generate coverage report
npm run test:coverage

# Interactive test UI (requires @vitest/ui)
npm run test:ui
```

#### Test Structure

```
__tests__/
├── components/              # Component unit tests
│   ├── Loader.test.tsx     # UI component tests
│   ├── QueryResult.test.tsx # Complex component tests
│   └── SavedQueriesPanel.test.tsx
├── services/               # Service layer tests  
│   ├── dbService.test.ts   # Database service tests
│   ├── geminiService.test.ts # AI service tests
│   ├── userDataService.test.ts # User data tests
│   └── mockData.test.ts    # Mock data validation
├── utils/                  # Utility function tests
│   └── schemaUtils.test.ts # Schema processing tests
├── pages/                  # Page component tests
│   └── QueryGeneratorPage.test.tsx
└── App.test.tsx           # Main app tests
```

### Test Coverage

Current coverage metrics:
- ✅ **Core Services**: 90%+ coverage (database, AI, user data)
- ✅ **UI Components**: 85%+ coverage with user interaction tests
- ✅ **Utility Functions**: 95%+ coverage (schema processing, formatting)
- ✅ **Page Components**: 80%+ coverage of main user flows
- ✅ **Error Handling**: Comprehensive error scenario testing
- ✅ **Authentication**: MSAL integration and token handling tests

### Testing Tools & Configuration

- **🧪 Vitest**: Lightning-fast unit test runner built for Vite
- **🧾 React Testing Library**: Simple and complete React DOM testing utilities  
- **🎭 User Event**: Fire events the same way users do
- **🔍 Jest DOM**: Custom Jest matchers for DOM elements
- **📊 Coverage**: Built-in code coverage with V8

#### Test Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/']
    }
  }
});
```

### Writing New Tests

When adding new components or features:

1. **Create corresponding test files** in `__tests__/` directory
2. **Follow naming convention**: `ComponentName.test.tsx` or `serviceName.test.ts`
3. **Test both happy paths and error scenarios**
4. **Mock external dependencies** appropriately (API calls, etc.)
5. **Maintain good test coverage** for critical functionality
6. **Use descriptive test names** that explain the expected behavior

#### Example Test Structure

```typescript
describe('SavedQueriesPanel', () => {
  it('should display loading state when queries are being fetched', () => {
    render(<SavedQueriesPanel isLoading={true} {...defaultProps} />);
    expect(screen.getByText(/loading your queries/i)).toBeInTheDocument();
  });

  it('should handle query sharing correctly', async () => {
    const mockOnShare = vi.fn();
    render(<SavedQueriesPanel onShare={mockOnShare} {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share/i });
    await user.click(shareButton);
    
    expect(mockOnShare).toHaveBeenCalledWith(expectedQuery);
  });
});
```

### Code Quality Tools

- **ESLint**: Code linting with React and TypeScript rules
- **Prettier**: Consistent code formatting  
- **TypeScript**: Strict type checking enabled
- **Husky**: Pre-commit hooks for quality gates

```bash
# Lint code
npm run lint

# Format code  
npm run format

# Type checking
npm run type-check
```

---

## 🚀 Deployment

### Google Cloud Run (Recommended)

#### Automatic Deployment
Push to the `production` branch triggers automatic deployment via GitHub Actions.

#### Manual Deployment

```bash
# 1. Build production container
docker build -t gcr.io/YOUR_PROJECT_ID/querypal-frontend \
  --build-arg VITE_API_BASE_URL=https://your-backend-url \
  --build-arg VITE_AZURE_REDIRECT_URI=https://your-frontend-url .

# 2. Push to registry
docker push gcr.io/YOUR_PROJECT_ID/querypal-frontend

# 3. Deploy to Cloud Run
gcloud run deploy querypal-frontend \
  --image gcr.io/YOUR_PROJECT_ID/querypal-frontend \
  --region europe-west1 \
  --port 4000 \
  --allow-unauthenticated
```

### Static Hosting (Netlify, Vercel, AWS S3)

```bash
# Build for static hosting
npm run build

# The dist/ folder contains the production build
# Deploy the contents to your static hosting provider
```

### Azure Static Web Apps

```yaml
# .github/workflows/azure-static-web-apps.yml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          api_location: ""
          output_location: "dist"
```

### Environment Variables for Production

```bash
# Build-time variables (set during docker build)
VITE_API_BASE_URL=https://your-backend-api.com
VITE_AZURE_REDIRECT_URI=https://your-frontend-domain.com
VITE_AZURE_CLIENT_ID=your-frontend-client-id
VITE_AZURE_TENANT_ID=your-tenant-id

# Optional: Analytics and monitoring
VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
VITE_SENTRY_DSN=your-sentry-dsn
```

---


## 🛠️ Development Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **React**: Modern hooks-based components with proper dependency arrays
- **Performance**: Lazy loading, memoization, and efficient re-renders
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Responsive**: Mobile-first design with progressive enhancement

### Adding New Features

1. **Define Types**: Add TypeScript interfaces in `types.ts`
2. **Create Components**: Build reusable components with proper props
3. **Add Services**: Implement API calls in the appropriate service file
4. **Write Tests**: Add comprehensive unit and integration tests
5. **Update Documentation**: Document new features and API changes

### Performance Best Practices

```typescript
// Lazy loading for large components
const DataExplorerPage = lazy(() => import('./pages/DataExplorerPage'));

// Memoization for expensive calculations
const processedData = useMemo(() => {
  return complexDataProcessing(rawData);
}, [rawData]);

// Debounced search inputs
const debouncedSearch = useDebounce(searchTerm, 300);
```

### State Management Guidelines

- **Local State**: Use `useState` for component-specific state
- **Shared State**: Use React Context for app-wide state
- **Server State**: Use React Query/SWR for API data management
- **Form State**: Use controlled components with validation

---

## 🔧 Troubleshooting

### Common Issues

#### Authentication Problems
```typescript
// Check MSAL configuration
console.log('MSAL Config:', msalConfig);
console.log('Login Request:', loginRequest);

// Verify token scopes
const account = msalInstance.getActiveAccount();
console.log('Active Account:', account);
```

#### API Connection Issues
```typescript
// Check API configuration
console.log('API Base URL:', API_BASE_URL);
console.log('Use MSAL Auth:', USE_MSAL_AUTH);

// Test API connectivity
fetch(`${API_BASE_URL}/health`)
  .then(res => res.json())
  .then(data => console.log('Backend Health:', data));
```

#### Build Problems
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Verify build configuration
npm run build -- --debug
```

### Debug Mode

Enable development debugging:

```typescript
// In config.ts
export const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Use throughout the app
if (DEBUG_MODE) {
  console.log('Debug info:', debugData);
}
```

---

## 📚 Additional Resources

- **React Documentation**: https://react.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Vite Guide**: https://vitejs.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Material-UI**: https://mui.com/getting-started/
- **MSAL.js Documentation**: https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications
- **Chart.js**: https://www.chartjs.org/docs/

---

## 🤝 Contributing

We welcome contributions to QueryPal! Please see our [Contributing Guidelines](../CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes with tests
4. **Run** the test suite (`npm test`)
5. **Ensure** code quality (`npm run lint`, `npm run type-check`)
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 👨‍💻 Author & Support

**Built by [Ching-En Lin](https://github.com/ChingEnLin)**

For questions, issues, or feature requests:
- 🐛 [Report Issues](https://github.com/ChingEnLin/QueryPal/issues)
- 💬 [Discussions](https://github.com/ChingEnLin/QueryPal/discussions)
- 📧 [Contact](mailto:support@querypal.com)

---

## 🔗 Related Links

- **🔗 Live Demo**: [QueryPal Production](https://querypal.virtonomy.io)
- **📖 Backend Documentation**: [Backend README](../backend/README.md)
- **🏗️ Deployment Guide**: [Deployment Documentation](../docs/deployment.md)
- **🔧 API Documentation**: [API Reference](https://api.querypal.virtonomy.io/docs)

---