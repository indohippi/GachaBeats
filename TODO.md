# TODO List - Post Overhaul

This document tracks remaining tasks after the comprehensive repository overhaul completed on January 13, 2026.

## 🔴 High Priority (Must Do)

### 1. Fix TypeScript Type Safety Issues
**Status**: Not Started
**Estimated Effort**: 4-6 hours

- [ ] Remove all `any` types (33 occurrences identified)
  - `server/routes.ts` (lines 52, 183) - Fix error handling types
  - `client/src/components/daw/AudioEngine.ts` (lines 475-507) - Create proper synth type unions
  - `client/src/components/daw/Sequencer.tsx` (line 25) - Create sequencer ref interface
  - `server/index.ts` (line 111) - Properly extend global type

**Files to update**:
```
server/routes.ts
server/index.ts
client/src/components/daw/AudioEngine.ts
client/src/components/daw/Sequencer.tsx
```

**Approach**:
```typescript
// Example: Create discriminated union for synth types
type SynthType =
  | { type: 'monosynth'; synth: Tone.MonoSynth }
  | { type: 'polysynth'; synth: Tone.PolySynth }
  | { type: 'fmsynth'; synth: Tone.FMSynth };
```

### 2. Replace console.log with Winston Logger
**Status**: Not Started
**Estimated Effort**: 2-3 hours

- [ ] Replace 125+ console.log/error/warn statements
- [ ] Import logger in all files
- [ ] Use appropriate log levels
- [ ] Add structured metadata where relevant

**Files affected**: All files with console statements

**Example replacement**:
```typescript
// Before
console.log('Server started');
console.error('Database error:', error);

// After
import { logger } from './logger';
logger.info('Server started');
logger.error('Database error', { error });
```

### 3. Add Comprehensive Test Coverage
**Status**: Framework ready, tests not written
**Estimated Effort**: 8-12 hours

- [ ] Authentication tests (register, login, logout)
- [ ] Gacha mechanics tests (pull, rarity distribution)
- [ ] API endpoint tests (all routes)
- [ ] DAW component tests (Sequencer, AudioEngine)
- [ ] Integration tests with database
- [ ] WebSocket tests

**Target Coverage**: 60% for all metrics

**Priority test files to create**:
```
server/auth.test.ts
server/routes.test.ts
client/src/components/daw/Sequencer.test.tsx
client/src/components/daw/AudioEngine.test.ts
client/src/pages/GachaApp.test.tsx
```

### 4. Fix Security Vulnerabilities
**Status**: Partially complete
**Estimated Effort**: 1-2 hours

Current vulnerabilities:
- [ ] esbuild <=0.24.2 (moderate) - Development server vulnerability
  - Not critical for production, but should update
  - Breaking change to 0.27.2

**Action**:
```bash
# Review breaking changes first
npm audit fix --force
# or manually update package.json
```

---

## 🟡 Medium Priority (Should Do)

### 5. Refactor Large Components
**Status**: Not Started
**Estimated Effort**: 6-8 hours

#### Sequencer.tsx (1000+ lines)
Break into smaller components:
- [ ] `SequencerControls.tsx` - BPM, play/stop controls
- [ ] `SequencerGrid.tsx` - Step sequencer grid
- [ ] `InstrumentSelector.tsx` - Instrument selection
- [ ] `EffectsPanel.tsx` - Effect controls
- [ ] `PresetManager.tsx` - Preset save/load

#### AudioEngine.ts (754 lines)
Break into modules:
- [ ] `synthFactory.ts` - Synth creation logic
- [ ] `effectsManager.ts` - Effects processing
- [ ] `audioScheduler.ts` - Timing and playback
- [ ] `types.ts` - All audio-related types

### 6. Implement Session Configuration Improvements
**Status**: Basic setup complete
**Estimated Effort**: 1-2 hours

- [ ] Add HttpOnly flag explicitly
- [ ] Implement SameSite configuration
- [ ] Add session rotation on login
- [ ] Implement refresh token mechanism
- [ ] Add session timeout warnings

### 7. Add Database Indexes
**Status**: Not Started
**Estimated Effort**: 1 hour

- [ ] Add index on `users.username` (for login queries)
- [ ] Add index on `sounds.category` (for filtering)
- [ ] Add composite index on `userSounds(userId, soundId)`
- [ ] Review and optimize slow queries

**File to update**: `db/schema.ts`

### 8. Implement Proper Gacha Backend
**Status**: Mock implementation exists
**Estimated Effort**: 4-6 hours

Current issues:
- Mock data hardcoded in `GachaCapture.tsx`
- Simple daily free pull only
- No coin economy persistence
- No rarity weights

Tasks:
- [ ] Create `coins` column in users table
- [ ] Implement coin purchase endpoints
- [ ] Add rarity weight system
- [ ] Implement proper gacha pull algorithm
- [ ] Add pull history tracking
- [ ] Implement pity system

---

## 🟢 Low Priority (Nice to Have)

### 9. Performance Optimizations
**Status**: Not Started
**Estimated Effort**: 6-8 hours

- [ ] Implement code splitting for routes
- [ ] Add lazy loading for heavy components
- [ ] Bundle size analysis with webpack-bundle-analyzer
- [ ] Audit unused UI components (40+ shadcn components)
- [ ] Implement virtual scrolling for sound lists
- [ ] Add service worker for offline capability
- [ ] Optimize audio engine initialization (lazy load)

### 10. Enhanced CI/CD
**Status**: Basic workflows complete
**Estimated Effort**: 2-4 hours

- [ ] Add deployment workflows (staging/production)
- [ ] Implement semantic versioning automation
- [ ] Add changelog generation
- [ ] Add Docker build in CI
- [ ] Implement deployment previews
- [ ] Add performance budgets
- [ ] Add visual regression testing (Percy/Chromatic)

### 11. Documentation Improvements
**Status**: Basic docs complete
**Estimated Effort**: 2-3 hours

- [ ] Add architecture diagrams
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Add component documentation (Storybook)
- [ ] Create video tutorials
- [ ] Add troubleshooting guide
- [ ] Document deployment process

### 12. Feature Completion
**Status**: Partially implemented
**Estimated Effort**: 12-16 hours

- [ ] Complete Stripe payment integration (currently mocked)
- [ ] Implement sound marketplace
- [ ] Add user profiles and avatars
- [ ] Implement social features (sharing, collaboration)
- [ ] Add sound effects library
- [ ] Implement pattern presets
- [ ] Add export functionality (WAV, MIDI)

---

## 🔧 Technical Debt

### Code Quality
- [ ] Remove all `console.*` statements (125+ occurrences)
- [ ] Add proper error boundaries in key areas
- [ ] Implement request validation middleware
- [ ] Add API versioning
- [ ] Create shared types package
- [ ] Add E2E tests with Playwright

### Infrastructure
- [ ] Set up staging environment
- [ ] Implement proper logging aggregation (Datadog, LogRocket)
- [ ] Add monitoring and alerting (Sentry, New Relic)
- [ ] Set up CDN for static assets
- [ ] Implement Redis for session store in production
- [ ] Add database backups automation

### Developer Experience
- [ ] Add VS Code recommended extensions
- [ ] Create debug configurations
- [ ] Add development database seeding
- [ ] Create mock data generators
- [ ] Add commit message linting (commitlint)

---

## 📊 Metrics to Track

### Code Quality
- [ ] Maintain 0 ESLint warnings
- [ ] Maintain 0 TypeScript errors
- [ ] Achieve 60%+ test coverage
- [ ] Keep bundle size under 1MB (target)

### Security
- [ ] 0 high/critical vulnerabilities
- [ ] 100% of auth endpoints rate limited
- [ ] All user inputs validated

### Performance
- [ ] Lighthouse score 90+ for all pages
- [ ] Time to Interactive < 3s
- [ ] First Contentful Paint < 1.5s

---

## 🎯 Sprint Planning Suggestion

### Sprint 1 (Week 1-2)
Focus: Critical fixes and testing foundation
- Fix TypeScript type safety issues
- Replace console.log with winston
- Add authentication tests
- Fix security vulnerabilities

### Sprint 2 (Week 3-4)
Focus: Test coverage and refactoring
- Add comprehensive test coverage
- Refactor Sequencer.tsx
- Refactor AudioEngine.ts
- Add database indexes

### Sprint 3 (Week 5-6)
Focus: Feature completion
- Implement proper gacha backend
- Complete coin economy
- Add payment integration
- Implement session improvements

### Sprint 4 (Week 7-8)
Focus: Performance and polish
- Performance optimizations
- Code splitting and lazy loading
- Bundle size optimization
- Documentation improvements

---

## 📝 Notes

### Dependencies to Monitor
- Watch for esbuild breaking changes
- Monitor Tone.js updates (audio engine)
- Keep Drizzle ORM updated
- Watch for React 19 release

### Future Considerations
- Consider migrating to Turborepo/Nx for monorepo management
- Evaluate moving to Bun for faster builds
- Consider GraphQL API layer
- Evaluate migrating to native bcrypt

---

## ✅ Completed (Reference)

- ✅ ESLint and Prettier configuration
- ✅ Vitest and React Testing Library setup
- ✅ Security improvements (helmet, cors, bcrypt)
- ✅ Winston logger implementation
- ✅ GitHub Actions CI/CD workflows
- ✅ Cursor AI configuration
- ✅ Pre-commit hooks (husky, lint-staged)
- ✅ Environment variable documentation
- ✅ Comprehensive README and CONTRIBUTING docs
- ✅ Issue and PR templates
- ✅ Removed duplicate Sequencer.new.tsx
- ✅ Optimized dependencies

---

**Last Updated**: January 13, 2026
**Status**: Repository ready for collaborative development
