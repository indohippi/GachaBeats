# GachaBeats 🎮🎵

A unique hybrid web application combining a gacha game with a collaborative digital audio workstation (DAW). Pull rare sound samples through a gacha system and use them to create music in real-time with other users.

## Features

### 🎰 Gacha System
- Pull sound samples with varying rarities (common, rare, epic, legendary)
- Virtual coin economy for gacha pulls
- Daily free pulls
- Animated prize reveals

### 🎹 Digital Audio Workstation
- 8-track sequencer with 16-step patterns
- Multiple synthesizer types (MonoSynth, PolySynth, FMSynth, AMSynth, etc.)
- Real-time effects processing (reverb, delay, distortion, chorus)
- Preset management system
- BPM control (60-200 BPM)
- Real-time multiplayer collaboration via WebSocket

### 🔒 Security & Authentication
- Secure user registration and login
- Session-based authentication with PostgreSQL
- Password hashing with bcrypt (12 salt rounds)
- CORS protection
- Helmet.js security headers
- Rate limiting

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Audio**: Tone.js
- **UI Components**: Radix UI primitives

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Authentication**: Passport.js with bcrypt
- **Session Store**: connect-pg-simple
- **Real-time**: WebSocket (ws)
- **Logging**: Winston

### DevOps & Quality
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Pre-commit Hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions
- **Security Scanning**: CodeQL, npm audit

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 16 or higher
- npm or yarn

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/gachabeats.git
cd gachabeats
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/gachabeats
SESSION_SECRET=your-super-secret-session-key
NODE_ENV=development
PORT=5000
```

### 4. Set Up Database

Ensure PostgreSQL is running, then push the database schema:

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run db:studio` - Open Drizzle Studio for database management

### Building
- `npm run build` - Build for production
- `npm start` - Start production server

### Testing
- `npm test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Generate coverage report

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run check` - Run TypeScript type checking

### Database
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open database studio

## Project Structure

```
gachabeats/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── daw/    # Digital Audio Workstation
│   │   │   ├── gacha/  # Gacha game mechanics
│   │   │   └── ui/     # shadcn/ui components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utilities
│   │   └── test/       # Test setup
│   └── public/         # Static assets
├── server/             # Backend Express server
│   ├── index.ts       # Server entry point
│   ├── routes.ts      # API routes
│   ├── auth.ts        # Authentication
│   ├── logger.ts      # Winston logger
│   └── vite.ts        # Vite integration
├── db/                # Database layer
│   ├── schema.ts      # Drizzle schemas
│   └── index.ts       # DB connection
├── .github/           # GitHub workflows & templates
│   └── workflows/     # CI/CD pipelines
├── .husky/           # Git hooks
└── [config files]    # Various configs
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Gacha
- `POST /api/gacha/pull` - Perform gacha pull
- `GET /api/gacha/collection` - Get user's collection

### DAW
- `GET /api/sounds` - Get available sounds
- `GET /api/user-sounds` - Get user's sound collection

### WebSocket
- `/ws` - WebSocket endpoint for real-time DAW collaboration

## Testing

Tests are written using Vitest and React Testing Library. To run tests:

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

Coverage thresholds are set to 60% for all metrics.

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **CI Pipeline**: Runs on every push and PR
  - Linting and type checking
  - Unit and integration tests
  - Build verification
  - Security audits

- **PR Checks**: Automated checks on pull requests
  - Changed file detection
  - Targeted test execution
  - PR status comments

- **CodeQL**: Weekly security scanning
- **Dependency Review**: Automatic license and vulnerability checks

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Run linting: `npm run lint:fix`
6. Commit with descriptive messages
7. Push and create a pull request

Pre-commit hooks will automatically:
- Run ESLint and fix issues
- Format code with Prettier
- Check for type errors

## Security

- Report security vulnerabilities via GitHub Security Advisories
- Password requirements: 8+ characters
- Sessions expire after 30 days
- Rate limiting on sensitive endpoints
- CORS protection enabled
- Security headers via Helmet.js

## Performance

- Bundle size optimized with code splitting
- WebSocket for efficient real-time communication
- Database connection pooling
- Audio scheduling for precise timing
- Efficient WebAudio API usage

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires Web Audio API support

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- shadcn/ui for the component library
- Tone.js for audio capabilities
- Radix UI for accessible primitives
- Drizzle for the excellent ORM

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/gachabeats/issues)
- Documentation: [Wiki](https://github.com/yourusername/gachabeats/wiki)

---

Built with ❤️ by the GachaBeats team
