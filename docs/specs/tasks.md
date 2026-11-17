# Implementation Plan: EBC Compass
## Personalized Academic and Professional Guidance System for Escuela Bancaria y Comercial

## Overview

This implementation plan breaks down the EBC Compass MVP into 11 phases covering preparation, data models, core features, testing, and validation. The system will be built as a TypeScript React SPA with mock data, local storage persistence, Spanish primary language, and comprehensive accessibility support.

**Technology Stack:**
- React 18+ with TypeScript 5+
- Vite 5+ build tool
- Tailwind CSS 3+ for styling
- Vitest + React Testing Library for testing
- fast-check for property-based testing
- react-i18next for internationalization
- date-fns for date handling

**Key Features:**
- 6 opportunity types (Course, Scholarship, Professional Development, Event, Procedure, Career Opportunity)
- Rule-based recommendation engine with prerequisite validation
- Bilingual conversational assistant (Spanish/English)
- Calendar and alert system with 3 urgency levels
- Responsive design (mobile 320px+, tablet 768px+, desktop 1280px+)
- WCAG 2.1 Level AA accessibility compliance

---

## Tasks

### Phase 1: Preparation & Setup

- [ ] 1.1 Initialize project structure and tooling
  - Create Vite + React + TypeScript project
  - Configure Tailwind CSS with custom design system
  - Set up ESLint and Prettier for code quality
  - Create directory structure: `/src/{components, services, models, utils, hooks, i18n, assets}`
  - Configure absolute imports with `@/` prefix
  - _Requirements: NF-01, NF-02_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 1.2 Configure testing infrastructure
  - Install and configure Vitest with jsdom environment
  - Set up React Testing Library
  - Install and configure fast-check for property-based testing
  - Install axe-core for accessibility testing
  - Create test utility files and custom matchers
  - Configure coverage reporting (target: 80%+)
  - _Requirements: All testing requirements_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 1.3 Set up internationalization (i18n) system
  - Install and configure react-i18next
  - Create Spanish (primary) and English translation files
  - Set up language detection and persistence
  - Create `useTranslation` hook wrapper
  - Define namespace structure for translations
  - _Requirements: RF-02.8, RF-05.1-3, NF-02.1-2_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 1.4 Set up routing and navigation
  - Install React Router v6
  - Define routes: Dashboard, Profile Edit, Catalog, Calendar, Chat
  - Create basic layout components (Header, Footer, Navigation)
  - Implement LanguageToggle component (ES/EN switch)
  - _Requirements: RF-02, RF-06, RF-05_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

### Phase 2: Data Model & Types

- [ ] 2.1 Define core TypeScript interfaces and enums
  - Create `Campus` enum (6 Mexican EBC locations)
  - Create `Career` enum (Banking, Finance, Marketing, Business Admin)
  - Define `StudentProfile` interface with all fields (name, campus, career, semester 1-10, completed courses, pending courses, interests, goals, availability, GPA)
  - Define `CompletedCourse` and `PendingCourse` interfaces
  - Define `AcademicProgress` interface
  - _Requirements: RF-01, BR-03, BR-05_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 2.2 Define opportunity type interfaces
  - Create base `Opportunity` interface with common fields
  - Define `Course` interface extending Opportunity (courseCode, credits, prerequisites, corequisites, semesterOffered, campus, required)
  - Define `Scholarship` interface with `EligibilityCriteria` (minGPA, careers, semesters, campuses, requirements)
  - Define `ProfessionalDevelopment`, `Event`, `Procedure`, `CareerOpportunity` interfaces
  - Create `OpportunityType` union type
  - _Requirements: RF-03, RF-06, BR-01, BR-02_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 2.3 Define recommendation and alert interfaces
  - Create `Recommendation` interface (id, profileId, opportunity, relevanceScore, explanation, generatedAt, dismissed)
  - Create `Alert` interface (id, profileId, urgency: normal/high/urgent, title, message, relatedDate, daysRemaining, dismissed)
  - Create `ImportantDate` interface (id, type, title, date, description)
  - Create `ConversationMessage` interface (id, profileId, role: student/assistant, content, language: es/en, timestamp)
  - _Requirements: RF-03, RF-04, RF-05, BR-04_
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ] 2.4 Create mock data provider with 5 student personas
  - Create `MockDataProvider` service class
  - Implement Banking Career Student persona (semester 2, 3 completed courses, interested in corporate banking)
  - Implement Finance Career Student persona (semester 5, 20 completed courses, interested in investment banking)
  - Implement Marketing Career Student persona (semester 6, 25 completed courses, interested in digital marketing)
  - Implement Business Admin Student persona (semester 8, 35 completed courses, interested in entrepreneurship)
  - Implement Returning Student persona (varied semester, transferred credits, interested in fintech)
  - All personas with Spanish language content and Mexican context
  - _Requirements: Mock Data Requirements section_
  - _Classification: MVP_
  - _Estimated Effort: 3-4 hours_

- [ ] 2.5 Create mock opportunity catalog data
  - Create 5+ courses with realistic EBC course codes, prerequisites, semester offerings (e.g., FIN-301, MKT-205, BAN-201)
  - Create 3+ scholarships with eligibility criteria, deadlines, award amounts (e.g., Santander Becas, Fundación EBC)
  - Create 3+ professional development opportunities (e.g., AMIB certification, Bloomberg Market Concepts)
  - Create 4+ events (banking conferences, career fairs, networking sessions, workshops)
  - Create 3+ administrative procedures (enrollment, transcript requests, scholarship applications)
  - Create 2+ career opportunities (internships, job postings in banking/finance)
  - All content in Spanish with realistic Mexican banking education context
  - _Requirements: Mock Data Requirements section, RF-06_
  - _Classification: MVP_
  - _Estimated Effort: 3-4 hours_

### Phase 3: Student Profile & Validations

- [ ] 3.1 Implement ProfileService with LocalStorage persistence
  - Create `ProfileService` class with save, load, update, delete, export methods
  - Implement LocalStorage read/write operations (key: `ebc_compass_profile`)
  - Add UUID generation for profile IDs
  - Implement error handling for storage quota exceeded
  - _Requirements: RF-01.10-11, NF-03.1-5_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ]* 3.2 Write property test for Profile Data Round-Trip Preservation (Property 1)
  - **Property 1: Profile Data Round-Trip Preservation**
  - **Validates: Requirements RF-01.10, RF-01.11, NF-03.4, NF-03.5**
  - Use fast-check to generate random valid StudentProfile objects
  - Test: save profile → load profile → verify all fields preserved
  - Verify name, campus, career, semester, completedCourses, interests, goals are identical
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ] 3.3 Implement profile validation logic
  - Create `ProfileValidator` class
  - Validate name (1-100 characters, required)
  - Validate campus (must be valid Campus enum, required)
  - Validate career (must be valid Career enum, required)
  - Validate currentSemester (integer 1-10, required)
  - Validate completedCourses array (0-50 items)
  - Validate interests array (0-10 items, each 1-50 chars)
  - Validate goals string (0-500 characters)
  - _Requirements: RF-01.1-9, BR-05.1_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ]* 3.4 Write property test for Semester Input Validation (Property 2)
  - **Property 2: Semester Input Validation**
  - **Validates: Requirements RF-01.4**
  - Use fast-check to generate random integers
  - Test: integers 1-10 should be valid, all others invalid
  - Verify error messages for out-of-range values
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 3.5 Implement profile completeness calculation
  - Create `CompletenessCalculator` class
  - Calculate completeness: (filled required fields ÷ 4) × 100
  - Required fields: name, campus, career, currentSemester
  - Return percentage (0-100) and list of missing fields
  - _Requirements: RF-01.12, BR-05.2-4_
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ]* 3.6 Write property test for Profile Completeness Calculation Accuracy (Property 3)
  - **Property 3: Profile Completeness Calculation Accuracy**
  - **Validates: Requirements RF-01.12, BR-05.2**
  - Use fast-check to generate partial profiles with missing required fields
  - Test: completeness = (filledCount ÷ 4) × 100
  - Verify percentage is between 0-100
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 3.7 Create ProfileForm component with all input fields
  - Create controlled form with React Hook Form or native state
  - Implement text input for name (RF-01.1)
  - Implement select dropdown for campus with 6 EBC locations (RF-01.2)
  - Implement select dropdown for career (4 options) (RF-01.3)
  - Implement number input for semester (1-10) with validation (RF-01.4)
  - Implement CourseListInput component for completed courses with add/remove (RF-01.5)
  - Implement CourseListInput component for pending courses with add/remove (RF-01.6)
  - Implement TagsInput component for interests (RF-01.7)
  - Implement textarea for professional goals (RF-01.8)
  - Implement CheckboxGroup for availability preferences (RF-01.9)
  - All labels and placeholders in Spanish
  - Form validation with error messages in Spanish
  - _Requirements: RF-01.1-9, NF-02.1_
  - _Classification: MVP_
  - _Estimated Effort: 4 hours_

- [ ] 3.8 Create ProfileCompletenessIndicator component
  - Display completeness percentage with progress bar
  - Show list of missing required fields when incomplete
  - Color-coded: green (100%), yellow (50-99%), red (<50%)
  - Prompt user to complete profile when below 100%
  - _Requirements: RF-01.12-13, BR-05.3_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 3.9 Create PersonaSelector component for testing
  - Display 5 predefined personas as selectable cards
  - Load persona data into profile form on selection
  - Help developers and testers quickly populate profiles
  - _Requirements: Mock Data Requirements_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

### Phase 4: Main Dashboard

- [ ] 4.1 Implement AcademicProgress calculation service
  - Create `ProgressCalculator` class
  - Calculate progress: (completedCount ÷ totalRequired) × 100
  - Define CAREER_TOTAL_COURSES map (Banking: 40, Finance: 40, Marketing: 38, Business Admin: 42)
  - Calculate expected graduation based on current semester and remaining courses
  - Determine "on track" status
  - _Requirements: RF-02.1, BR-03.1-5_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ]* 4.2 Write property test for Academic Progress Calculation Formula (Property 9)
  - **Property 9: Academic Progress Calculation Formula**
  - **Validates: Requirements RF-02.1, BR-03.1, BR-03.3**
  - Use fast-check to generate completed course counts and total required
  - Test: progress = (completedCount ÷ totalRequired) × 100, capped at 100
  - Verify all fields (percentage, completedCount, totalRequired) are correct
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 4.3 Create AcademicProgressWidget component
  - Display circular progress chart showing percentage
  - Show "X/Y cursos completados" text
  - Display expected graduation date ("Graduación: Jun 2025")
  - Show "on track" indicator (green check or yellow warning)
  - All text in Spanish
  - Responsive design for mobile/tablet/desktop
  - _Requirements: RF-02.1, NF-01.3-6_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 4.4 Create AlertsWidget component
  - Display up to 5 concurrent alerts (BR-04.6)
  - Color-coded by urgency: urgent (red), high (orange), normal (blue)
  - Show days remaining prominently
  - Implement dismiss functionality (X button)
  - Responsive layout for mobile/tablet/desktop
  - All text in Spanish
  - _Requirements: RF-04.10-11, BR-04.6_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 4.5 Create RecommendationCard component
  - Display opportunity type badge (color-coded)
  - Show title and description
  - Display relevance explanation
  - Show date/deadline if applicable with days remaining
  - Call-to-action button ("Ver detalles", "Inscribirse", "Solicitar")
  - Responsive card layout
  - _Requirements: RF-02.6, RF-03, RF-06.12_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 4.6 Create RecommendationsWidget component
  - Display feed of 5-10 recommendations
  - Group by opportunity type with section headers
  - Show "No hay recomendaciones" empty state when no recs available
  - Implement dismiss functionality for individual recommendations
  - Responsive grid layout (1 column mobile, 2 columns tablet, 3 columns desktop)
  - _Requirements: RF-02.6, RF-03_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 4.7 Create UpcomingDatesWidget component
  - Display next 5 important dates in chronological order
  - Show date, title, and type icon
  - Format dates in Spanish (e.g., "15 de abril de 2024")
  - Link to full calendar view
  - _Requirements: RF-02.5, RF-04.1-6_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 4.8 Create Dashboard page with responsive layout
  - Implement WelcomeHeader with student name and semester
  - Arrange widgets: ProfileSidebar (left), AcademicProgressWidget (top), AlertsWidget, RecommendationsWidget, UpcomingDatesWidget
  - Implement mobile layout: single column, stacked widgets, bottom navigation
  - Implement tablet layout: two columns, sidebar + main content
  - Implement desktop layout: three columns (sidebar, main, quick actions)
  - _Requirements: RF-02, NF-01.3-6_
  - _Classification: MVP_
  - _Estimated Effort: 3-4 hours_

- [ ] 4.9 Create OnboardingFlow component for new users
  - Detect when profile is empty (first visit)
  - Show welcome modal explaining EBC Compass features
  - Guide user to create profile with step-by-step wizard
  - Allow user to skip onboarding and go directly to profile form
  - Store onboarding completion in LocalStorage
  - _Requirements: RF-02.10_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 4.10 Checkpoint - Dashboard UI complete
  - Ensure all dashboard widgets render correctly
  - Verify responsive behavior on mobile (320px), tablet (768px), desktop (1280px)
  - Test with empty profile, incomplete profile, and complete profile states
  - Ensure all Spanish translations are correct
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 5: Opportunities Catalog

- [ ] 5.1 Create CatalogFilterService for opportunity filtering
  - Implement filterByType: filter opportunities by OpportunityType
  - Implement filterByCareer: filter by Career or show all if no career restriction
  - Implement filterBySemester: filter by semester relevance
  - Implement filterByDeadline: exclude opportunities with past deadlines
  - Support multiple filters simultaneously (AND logic)
  - _Requirements: RF-06.7-9, BR-02.5_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ]* 5.2 Write property test for Catalog Filtering by Type (Property 16)
  - **Property 16: Catalog Filtering by Type**
  - **Validates: Requirements RF-06.7**
  - Use fast-check to generate opportunity catalogs and type selections
  - Test: all filtered opportunities match selected type exactly
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 5.3 Write property test for Catalog Filtering by Career (Property 17)
  - **Property 17: Catalog Filtering by Career**
  - **Validates: Requirements RF-06.8**
  - Use fast-check to generate catalogs and career selections
  - Test: filtered opportunities match career or have no career restriction
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 5.4 Create CatalogSearchService for keyword search
  - Implement fuzzy keyword matching across title, description, tags
  - Case-insensitive search
  - Highlight matched terms in results (optional enhancement)
  - Return relevance-ranked results
  - _Requirements: RF-06.10_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ]* 5.5 Write property test for Keyword Search Matches (Property 18)
  - **Property 18: Keyword Search Matches**
  - **Validates: Requirements RF-06.10**
  - Use fast-check to generate search keywords and catalogs
  - Test: all results contain keyword in title, description, or tags (case-insensitive)
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 5.6 Create FilterSidebar component
  - Implement TypeFilter with checkboxes for 6 opportunity types
  - Implement CareerFilter with checkboxes for 4 careers
  - Implement SemesterFilter with range slider (1-10)
  - Show count of active filters
  - "Clear all filters" button
  - Collapsible sections for mobile
  - _Requirements: RF-06.7-9_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 5.7 Create SearchBar component with debounced input
  - Text input with search icon
  - Debounce search queries (300ms delay)
  - Clear button when input has value
  - Accessible label and ARIA attributes
  - _Requirements: RF-06.10, NF-02.3-4_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 5.8 Create OpportunityCard component (detailed view)
  - Display all opportunity fields based on type (course details, scholarship eligibility, event info, etc.)
  - Show "Recomendado para ti" badge if recommended
  - Display days remaining for deadlines
  - Action buttons: "Ver detalles", "Solicitar", "Inscribirse"
  - Responsive card design
  - _Requirements: RF-06.1-6, RF-06.12-13_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 5.9 Create OpportunitiesCatalogPage with grid layout
  - Integrate FilterSidebar (collapsible on mobile)
  - Integrate SearchBar at top
  - Display OpportunityGrid with filtered/searched results
  - Show result count ("24 oportunidades encontradas")
  - Show empty state when no results ("No se encontraron oportunidades")
  - Implement pagination or infinite scroll for large result sets
  - Responsive layout: sidebar + grid on desktop, stacked on mobile
  - _Requirements: RF-06, NF-01.3-6_
  - _Classification: MVP_
  - _Estimated Effort: 3-4 hours_

- [ ] 5.10 Checkpoint - Catalog feature complete
  - Test filtering by type, career, semester combinations
  - Test keyword search with various queries
  - Verify all 20+ mock opportunities display correctly
  - Test responsive behavior on all breakpoints
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 6: Rule-based Recommendation Engine

- [ ] 6.1 Create PrerequisiteValidator service
  - Implement validate method: check if all prerequisites are in completed courses
  - Return validation result with list of missing prerequisites
  - Implement calculatePrerequisiteChain: find all prerequisite courses recursively
  - Generate optimal course sequence from target course back to first prerequisite
  - _Requirements: RF-03.3, RF-03.9, BR-01.1, BR-01.5_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ]* 6.2 Write property test for Prerequisite Validation Enforcement (Property 4)
  - **Property 4: Prerequisite Validation Enforcement**
  - **Validates: Requirements RF-03.3, RF-03.9, BR-01.1**
  - Use fast-check to generate courses with prerequisites and completed course lists
  - Test: courses without met prerequisites must NOT be recommended
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ]* 6.3 Write property test for Semester-Appropriate Course Filtering (Property 5)
  - **Property 5: Semester-Appropriate Course Filtering**
  - **Validates: Requirements RF-03.2, BR-01.2**
  - Use fast-check to generate courses with semester offerings and current semesters
  - Test: courses not offered in current semester must NOT be recommended
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 6.4 Write property test for No Duplicate Course Recommendations (Property 6)
  - **Property 6: No Duplicate Course Recommendations**
  - **Validates: Requirements BR-01.3**
  - Use fast-check to generate profiles with completed courses
  - Test: no completed course should appear in recommendations
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 6.5 Create CourseRecommendationService
  - Implement recommendCourses method with all filtering logic:
    - Check prerequisites are met (BR-01.1)
    - Check semester offerings (BR-01.2)
    - Exclude completed courses (BR-01.3)
    - Check career relevance (RF-03.1)
    - Check campus availability
  - Calculate relevance score: required courses +50, career match +30, interest match +10 each, semester appropriate +20
  - Generate explanation text in Spanish
  - Prioritize required courses over electives (BR-01.4)
  - _Requirements: RF-03.1-3, BR-01_
  - _Classification: MVP_
  - _Estimated Effort: 4 hours_

- [ ] 6.6 Create ScholarshipRecommendationService
  - Implement recommendScholarships method with eligibility checking:
    - Check minimum GPA requirement (BR-02.1)
    - Check career-specific eligibility (BR-02.2)
    - Check semester requirements (BR-02.3)
    - Check campus restrictions (BR-02.4)
    - Exclude scholarships with past deadlines (BR-02.5)
  - Calculate relevance score based on eligibility match
  - Generate explanation text in Spanish
  - _Requirements: RF-03.4, BR-02_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ]* 6.7 Write property test for Scholarship Eligibility Enforcement (Property 7)
  - **Property 7: Scholarship Eligibility Enforcement**
  - **Validates: Requirements RF-03.4, RF-03.10, BR-02.1-4**
  - Use fast-check to generate scholarships with eligibility criteria and profiles
  - Test: scholarships where profile doesn't meet GPA, career, semester, or campus criteria must NOT be recommended
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ]* 6.8 Write property test for Deadline Filtering for Scholarships (Property 8)
  - **Property 8: Deadline Filtering for Scholarships**
  - **Validates: Requirements BR-02.5**
  - Use fast-check to generate scholarships with past deadlines
  - Test: scholarships with past deadlines must NOT be recommended
  - _Classification: MVP Testing_
  - _Estimated Effort: 1 hour_

- [ ] 6.9 Create ProfDevRecommendationService
  - Implement recommendProfDev method
  - Match professional development opportunities to career interests
  - Match to student's stated professional goals
  - Calculate relevance score based on career and interest matches
  - Generate explanation text in Spanish
  - _Requirements: RF-03.5_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 6.10 Create EventRecommendationService
  - Implement recommendEvents method
  - Match industry events to career field
  - Match to student interests
  - Prioritize upcoming events
  - Calculate relevance score
  - Generate explanation text in Spanish
  - _Requirements: RF-03.6_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 6.11 Create ProcedureRecommendationService
  - Implement recommendProcedures method
  - Match administrative procedures to current semester (e.g., enrollment procedures for semester start)
  - Detect pending requirements based on profile
  - Prioritize time-sensitive procedures
  - Generate explanation text in Spanish
  - _Requirements: RF-03.7_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 6.12 Create CareerRecommendationService
  - Implement recommendCareers method
  - Match career opportunities to student career field
  - Match to completed courses (required skills)
  - Match to professional goals
  - Match to semester (e.g., internships for semester 5+)
  - Calculate relevance score
  - Generate explanation text in Spanish
  - _Requirements: RF-03.8_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 6.13 Create RecommendationEngine orchestrator
  - Aggregate all 6 recommendation services
  - Implement generateRecommendations method that calls all services
  - Collect all recommendations into single array
  - Rank recommendations by relevance score (descending)
  - Return top 10-20 recommendations
  - Handle incomplete profiles gracefully (RF-03.12)
  - Ensure response time < 2 seconds (RF-03.13)
  - _Requirements: RF-03, BR-01, BR-02_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ]* 6.14 Write property test for Recommendation Ranking by Relevance Score (Property 13)
  - **Property 13: Recommendation Ranking by Relevance Score**
  - **Validates: Requirements RF-03.11**
  - Use fast-check to generate unordered recommendation arrays
  - Test: ranked output is sorted descending by relevance score
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 6.15 Write property test for Profile Update Triggers Recommendation Refresh (Property 20)
  - **Property 20: Profile Update Triggers Recommendation Refresh**
  - **Validates: Requirements RF-02.7, RF-03.12**
  - Use fast-check to generate profiles, modify them, regenerate recommendations
  - Test: recommendations are recalculated with new generatedAt timestamp
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ] 6.16 Checkpoint - Recommendation engine complete
  - Test all 6 recommendation services with mock data
  - Verify prerequisite validation works correctly
  - Verify eligibility enforcement works correctly
  - Test with incomplete profiles
  - Verify performance < 2 seconds
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 7: Calendar & Alerts

- [ ] 7.1 Create ImportantDateService to manage dates
  - Load mock important dates (enrollment periods, exam dates, scholarship deadlines, events, holidays)
  - Implement getUpcomingDates method (next 30 days)
  - Implement getDatesByType method
  - Implement getDatesByMonth for calendar view
  - Format dates in Spanish locale using date-fns
  - _Requirements: RF-04.1-6_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 7.2 Create AlertService for alert generation and management
  - Implement generateAlerts method:
    - Calculate days remaining for each important date
    - Generate alert for dates 1-7 days away (RF-04.7, BR-04.1)
    - Set urgency: urgent (1 day), high (2-3 days), normal (4-7 days) (BR-04.2-3)
    - Deduplicate alerts by title and date (BR-04.4)
    - Limit to 5 most urgent alerts (BR-04.6)
  - Implement dismissAlert method with persistence
  - Implement getDismissedAlerts to exclude from display (BR-04.5)
  - Store dismissed alerts in LocalStorage
  - _Requirements: RF-04.7-11, BR-04_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ]* 7.3 Write property test for Alert Generation with Correct Urgency Levels (Property 10)
  - **Property 10: Alert Generation with Correct Urgency Levels**
  - **Validates: Requirements RF-04.7, BR-04.1-3**
  - Use fast-check to generate dates with varying days until deadline
  - Test: 1 day = urgent, 2-3 days = high, 4-7 days = normal, >7 or <1 = no alert
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ]* 7.4 Write property test for Alert Deduplication (Property 11)
  - **Property 11: Alert Deduplication**
  - **Validates: Requirements BR-04.4**
  - Use fast-check to generate dates with intentional duplicates
  - Test: output alerts have no duplicate title+date combinations
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 7.5 Write property test for Maximum 5 Concurrent Alerts (Property 12)
  - **Property 12: Maximum 5 Concurrent Alerts**
  - **Validates: Requirements BR-04.6**
  - Use fast-check to generate many dates within alert range
  - Test: output is limited to 5 alerts, sorted by urgency (earliest first)
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 7.6 Write property test for Alert Dismissal Persistence (Property 19)
  - **Property 19: Alert Dismissal Persistence**
  - **Validates: Requirements BR-04.5**
  - Test: dismissed alert doesn't reappear in subsequent generations unless urgency increases
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ] 7.7 Create CalendarComponent with month view
  - Display calendar grid for current month
  - Show important dates as colored dots or labels on calendar days
  - Implement month navigation (previous/next month)
  - Highlight today's date
  - Click on date to see all events for that day
  - Responsive design for mobile/tablet/desktop
  - All labels in Spanish
  - _Requirements: RF-04.1-6, RF-04.12, NF-02.1_
  - _Classification: MVP_
  - _Estimated Effort: 4 hours_

- [ ] 7.8 Create ImportantDatesList component
  - Display list of upcoming dates in chronological order
  - Group by date type (enrollment, exam, deadline, event, holiday)
  - Show date, title, description, type icon
  - Format dates in Spanish (e.g., "15 de abril de 2024")
  - Color-code by urgency if within 7 days
  - _Requirements: RF-04.1-6, RF-04.12_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 7.9 Create CalendarPage integrating calendar and dates list
  - Layout: MonthView (left), ImportantDatesList (right) on desktop
  - Stacked layout on mobile/tablet
  - Show AlertsPanel with current alerts
  - Filter dates by type (checkboxes)
  - Export to calendar functionality (future enhancement placeholder)
  - _Requirements: RF-04, NF-01.3-6_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 7.10 Checkpoint - Calendar and alerts complete
  - Test alert generation with various date scenarios
  - Verify urgency levels are correct
  - Test alert dismissal and persistence
  - Verify calendar displays dates correctly
  - Test responsive behavior
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 8: Simulated Conversational Assistant

- [ ] 8.1 Create LanguageDetector service
  - Implement detectLanguage method
  - Use keyword-based detection (Spanish indicators: "que", "como", "cuando", etc.; English: "what", "how", "when", etc.)
  - Return "es" or "en"
  - Default to Spanish if ambiguous
  - _Requirements: RF-05.1-3_
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ]* 8.2 Write property test for Language Detection and Response Matching (Property 14)
  - **Property 14: Language Detection and Response Matching**
  - **Validates: Requirements RF-05.1-3**
  - Use fast-check to generate query strings
  - Test: detected language is "es" or "en", response is in same language
  - Test: Spanish queries get Spanish responses, English queries get English responses
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ] 8.3 Create KeywordMatcher service
  - Implement fuzzy keyword matching algorithm
  - Extract keywords from query (remove stop words)
  - Match keywords against intents (course-info, scholarship-info, procedure-info, recommendation-request, general-question)
  - Support Spanish and English keywords
  - Return matched intent with confidence score
  - _Requirements: RF-05.4_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 8.4 Create ContextEnricher service
  - Inject student profile context into responses
  - Personalize responses with student name, career, semester
  - Reference completed courses when relevant
  - Reference interests when relevant
  - _Requirements: RF-05.5-7_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 8.5 Create QueryHandler service
  - Implement handleCourseInfo: explain course prerequisites, semester offerings, credits
  - Implement handleScholarshipInfo: explain eligibility criteria, deadlines, award amounts
  - Implement handleProcedureInfo: explain procedure steps, required documents, processing time
  - Implement handleRecommendationRequest: call recommendation engine and format results
  - Implement handleGeneralQuestion: provide generic helpful response
  - Generate all responses in appropriate language (Spanish or English)
  - _Requirements: RF-05.8-10_
  - _Classification: MVP_
  - _Estimated Effort: 4 hours_

- [ ] 8.6 Create ConversationalAssistant orchestrator
  - Implement processQuery method:
    - Detect language
    - Extract keywords and match intent
    - Route to appropriate QueryHandler method
    - Enrich response with context
    - Return ConversationMessage
  - Ensure response time < 2 seconds (RF-05.12)
  - Implement fallback logic for unmatched queries (RF-05.13-14)
  - Suggest alternative questions when no match found
  - Direct to EBC resources when information is lacking
  - _Requirements: RF-05_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 8.7 Create ConversationHistory component
  - Display list of messages (student and assistant)
  - Student messages aligned right, assistant messages aligned left
  - Show timestamps
  - Different styling for student vs assistant messages
  - Scroll to bottom on new message
  - Load previous messages from LocalStorage
  - _Requirements: RF-05_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 8.8 Create QueryInput component
  - Text input field with placeholder "Escribe tu pregunta..."
  - Send button or Enter key to submit
  - Loading state while processing
  - Character limit (500 chars)
  - Accessible label and ARIA attributes
  - _Requirements: RF-05, NF-02.3-4_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 8.9 Create SuggestedQuestions component
  - Display 3-5 suggested questions to help users get started
  - Questions in Spanish by default, English when language is English
  - Examples: "¿Qué becas están disponibles?", "¿Cuáles son los requisitos de FIN-301?", "¿Cómo solicito una beca?"
  - Click on suggestion to auto-fill query input
  - _Requirements: RF-05.13_
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ] 8.10 Create ChatPage integrating conversation components
  - Layout: ConversationHistory (main area), QueryInput (bottom), SuggestedQuestions (sidebar or below input)
  - Mobile layout: stacked, full-width input at bottom
  - Persist conversation to LocalStorage
  - Clear conversation button
  - _Requirements: RF-05, NF-01.3-6_
  - _Classification: MVP_
  - _Estimated Effort: 2-3 hours_

- [ ] 8.11 Checkpoint - Conversational assistant complete
  - Test with Spanish queries
  - Test with English queries
  - Test mixed language scenarios
  - Verify intent matching works correctly
  - Test fallback responses
  - Verify performance < 2 seconds
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 9: Empty States, Errors & Accessibility

- [ ] 9.1 Create EmptyState components for all views
  - EmptyProfileState: "Crea tu perfil para comenzar"
  - EmptyRecommendationsState: "Completa tu perfil para recibir recomendaciones personalizadas"
  - EmptyCatalogSearchState: "No se encontraron oportunidades con esos filtros"
  - EmptyAlertsState: "No tienes alertas pendientes"
  - EmptyConversationState: "Haz una pregunta para comenzar"
  - All with helpful illustrations and call-to-action buttons
  - _Requirements: RF-02.10, All empty state scenarios_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 9.2 Create ErrorBoundary component
  - Catch React errors and display friendly error message
  - Log errors to console (future: send to error tracking service)
  - "Algo salió mal" message with reload button
  - Prevent entire app from crashing
  - _Requirements: Error handling_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.3 Implement global error handling
  - Handle LocalStorage quota exceeded errors
  - Handle network errors for future API calls
  - Display toast notifications for errors
  - Spanish error messages
  - _Requirements: Error handling_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.4 Implement keyboard navigation throughout app
  - Ensure all interactive elements are keyboard accessible (Tab, Enter, Space, Escape)
  - Implement focus trap for modals
  - Skip to main content link (hidden, visible on focus)
  - Arrow key navigation for lists and menus
  - Visible focus indicators on all interactive elements (2px outline)
  - _Requirements: NF-02.4, NF-02.7_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 9.5 Add ARIA labels and semantic HTML throughout app
  - Use semantic HTML elements (nav, main, article, section, header, footer)
  - Add aria-label to all icon buttons
  - Add aria-describedby for complex components
  - Add role attributes where necessary (progressbar, alert, dialog)
  - Add aria-live regions for dynamic content (alerts, recommendations)
  - _Requirements: NF-02.3, NF-02.8_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 9.6 Ensure color contrast meets WCAG 2.1 AA standards
  - Verify all text has 4.5:1 contrast ratio minimum
  - Verify interactive elements have 3:1 contrast ratio minimum
  - Test with color contrast checker tool
  - Adjust colors if needed
  - _Requirements: NF-02.6_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.7 Add alternative text for all images and icons
  - Decorative images: alt="" and aria-hidden="true"
  - Informative images: descriptive alt text in Spanish
  - Opportunity type icons: alt="Icono de curso académico", etc.
  - Profile photos: alt="Foto de perfil de [name]"
  - _Requirements: NF-02.5_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.8 Implement screen reader support
  - Test with VoiceOver (macOS), NVDA (Windows)
  - Ensure all content is readable by screen readers
  - Ensure navigation makes sense with screen reader
  - Add visually hidden labels where necessary
  - _Requirements: NF-02.8_
  - _Classification: MVP_
  - _Estimated Effort: 3 hours_

- [ ] 9.9 Implement PrivacyPolicyModal component
  - Display privacy policy text in Spanish
  - Explain data collection and storage practices
  - Explain user rights (export, delete data)
  - Link from footer
  - _Requirements: NF-03.6_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.10 Implement ConsentDialog for new users
  - Show on first profile creation
  - Explain data collection in simple terms
  - Require explicit consent to proceed
  - Link to full privacy policy
  - Store consent status in LocalStorage
  - _Requirements: NF-03.7_
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 9.11 Checkpoint - Accessibility and error handling complete
  - Run axe-core accessibility audit
  - Test keyboard navigation on all pages
  - Test with screen reader
  - Verify all empty states render correctly
  - Test error scenarios
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 10: Unit, Component & Flow Tests

- [ ]* 10.1 Write unit tests for all service classes
  - ProfileService: save, load, update, delete, export methods
  - CompletenessCalculator: calculate method with various profile states
  - ProgressCalculator: calculate method with various completion levels
  - PrerequisiteValidator: validate and calculatePrerequisiteChain methods
  - All 6 recommendation services: test filtering and scoring logic
  - RecommendationEngine: test orchestration and ranking
  - AlertService: test generation, deduplication, limiting, dismissal
  - ImportantDateService: test date filtering and formatting
  - LanguageDetector: test detection accuracy
  - KeywordMatcher: test fuzzy matching
  - ConversationalAssistant: test query processing and response generation
  - Target: 80%+ code coverage for services layer
  - _Classification: MVP Testing_
  - _Estimated Effort: 8 hours_

- [ ]* 10.2 Write component tests for all UI components
  - ProfileForm: test input validation, form submission, error display
  - ProfileCompletenessIndicator: test percentage display, missing fields list
  - AcademicProgressWidget: test progress display, graduation date
  - AlertsWidget: test alert display, color coding, dismissal
  - RecommendationCard and RecommendationsWidget: test rendering, dismissal
  - FilterSidebar and SearchBar: test filtering and search interaction
  - OpportunityCard: test display of all 6 opportunity types
  - CalendarComponent: test date display, navigation, date selection
  - ConversationHistory and QueryInput: test message display, input handling
  - EmptyState components: test rendering
  - Target: 80%+ code coverage for components
  - _Classification: MVP Testing_
  - _Estimated Effort: 8 hours_

- [ ]* 10.3 Write property test for Days Remaining Calculation Accuracy (Property 15)
  - **Property 15: Days Remaining Calculation Accuracy**
  - **Validates: Requirements RF-06.13**
  - Use fast-check to generate future deadline dates
  - Test: daysRemaining = Math.floor((deadline - today) / 86400000)
  - Verify result is always ≥ 0
  - _Classification: MVP Testing_
  - _Estimated Effort: 1-2 hours_

- [ ]* 10.4 Write integration tests for key user flows
  - Flow 1: New user → onboarding → create profile → view dashboard
  - Flow 2: Complete profile → receive recommendations → view opportunity details
  - Flow 3: Search catalog → apply filters → view results → clear filters
  - Flow 4: View calendar → see alerts → dismiss alert
  - Flow 5: Ask question in chat → receive response → ask follow-up
  - Use Playwright or React Testing Library for end-to-end component integration
  - _Classification: MVP Testing_
  - _Estimated Effort: 6 hours_

- [ ]* 10.5 Write accessibility tests with axe-core
  - Run axe-core on all pages
  - Test Dashboard, Profile Edit, Catalog, Calendar, Chat pages
  - Verify WCAG 2.1 Level AA compliance
  - Fix any accessibility violations found
  - _Requirements: NF-02.3_
  - _Classification: MVP Testing_
  - _Estimated Effort: 3 hours_

- [ ]* 10.6 Write responsive design tests
  - Test rendering at mobile breakpoint (320px, 375px, 428px)
  - Test rendering at tablet breakpoint (768px, 1024px)
  - Test rendering at desktop breakpoint (1280px, 1440px, 1920px)
  - Verify layouts adjust correctly
  - Verify no horizontal scroll on mobile
  - Use visual regression testing tools (optional: Percy, Chromatic)
  - _Requirements: NF-01.3-6_
  - _Classification: MVP Testing_
  - _Estimated Effort: 4 hours_

- [ ]* 10.7 Write performance smoke tests
  - Test dashboard load time (target: < 3 seconds on 4G)
  - Test recommendation generation time (target: < 2 seconds)
  - Test conversational assistant response time (target: < 2 seconds)
  - Use Performance API or Lighthouse
  - _Requirements: NF-01.1-2, RF-03.13, RF-05.12_
  - _Classification: MVP Testing_
  - _Estimated Effort: 2 hours_

- [ ] 10.8 Checkpoint - All tests complete
  - Verify all 20 property-based tests pass
  - Verify unit test coverage ≥ 80%
  - Verify component test coverage ≥ 80%
  - Verify integration tests pass
  - Verify accessibility tests pass (no WCAG violations)
  - Verify responsive design tests pass
  - Verify performance tests meet targets
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

### Phase 11: Final Validation

- [ ] 11.1 Verify all RF-01 acceptance criteria (Student Profile Management)
  - RF-01.1-9: All profile fields captured correctly
  - RF-01.10-11: Profile save and edit functionality works
  - RF-01.12-13: Completeness calculation and prompts work
  - Test with all 5 personas
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.2 Verify all RF-02 acceptance criteria (Dashboard)
  - RF-02.1-2: Academic progress and semester display
  - RF-02.3-6: Recommendations, procedures, dates, feed display
  - RF-02.7: Recommendations refresh on profile update
  - RF-02.8: Spanish primary language
  - RF-02.9: Responsive mobile design
  - RF-02.10: Onboarding for new users
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.3 Verify all RF-03 acceptance criteria (Recommendations)
  - RF-03.1-8: All 6 recommendation types work correctly
  - RF-03.9-10: Prerequisites and eligibility enforced
  - RF-03.11: Prioritization by relevance
  - RF-03.12-13: Incomplete profiles handled, performance < 2s
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.4 Verify all RF-04 acceptance criteria (Calendar & Alerts)
  - RF-04.1-6: All date types displayed in calendar
  - RF-04.7-9: Alerts generated correctly
  - RF-04.10-12: Alerts displayed, dismissible, Spanish language
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ] 11.5 Verify all RF-05 acceptance criteria (Conversational Assistant)
  - RF-05.1-3: Spanish and English input/output
  - RF-05.4: Fuzzy keyword matching
  - RF-05.5-7: Context-aware responses
  - RF-05.8-10: Explains prerequisites, eligibility, procedures
  - RF-05.11-12: Rule-based logic, response < 2s
  - RF-05.13-14: Fallback logic works
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.6 Verify all RF-06 acceptance criteria (Catalog)
  - RF-06.1-6: All 6 opportunity types in catalog
  - RF-06.7-10: Filtering and search work correctly
  - RF-06.11-13: Spanish display, recommended indicator, days remaining
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.7 Verify all NF-01 acceptance criteria (Performance)
  - NF-01.1-2: Response time < 2s, dashboard load < 3s
  - NF-01.3-6: Responsive rendering at all breakpoints
  - NF-01.7: Optimized assets
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ] 11.8 Verify all NF-02 acceptance criteria (Accessibility)
  - NF-02.1-2: Spanish primary, English secondary
  - NF-02.3: WCAG 2.1 Level AA compliance
  - NF-02.4-8: Keyboard nav, alt text, contrast, focus, screen reader
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.9 Verify all NF-03 acceptance criteria (Privacy)
  - NF-03.1-3: Minimal data collection, secure storage, no third-party sharing
  - NF-03.4-5: Data export and deletion work
  - NF-03.6-7: Privacy policy and consent displayed
  - _Classification: MVP_
  - _Estimated Effort: 1-2 hours_

- [ ] 11.10 Verify all BR-01 to BR-05 business rules
  - BR-01: Course recommendation rules (prerequisites, semester, duplicates, priority, chains)
  - BR-02: Scholarship recommendation rules (GPA, career, semester, campus, deadline)
  - BR-03: Progress calculation rules (formula, fallback, percentage, update, graduation)
  - BR-04: Alert generation rules (urgency levels, deduplication, dismissal, limit)
  - BR-05: Profile completeness rules (required fields, calculation, missing fields, feature gating)
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.11 Create user documentation
  - Write README.md with project overview, tech stack, setup instructions
  - Document all personas for testing
  - Document mock data structure
  - Create CONTRIBUTING.md for future developers
  - _Classification: MVP_
  - _Estimated Effort: 2 hours_

- [ ] 11.12 Final checkpoint - MVP complete
  - All 100+ acceptance criteria verified
  - All 20 property-based tests passing
  - 80%+ test coverage
  - WCAG 2.1 Level AA compliance
  - Performance targets met
  - All features working in Spanish
  - Responsive design working on all breakpoints
  - Ready for user acceptance testing
  - Ensure all tests pass, ask the user if questions arise
  - _Classification: MVP Checkpoint_

---

## Notes

- **Task Classification**: 
  - `MVP` = Core implementation task required for minimum viable product
  - `MVP Testing` = Test task (unit, component, property-based, integration, accessibility)
  - Tasks marked with `*` are optional testing tasks (can be skipped for faster MVP delivery)
  
- **Property-Based Tests**: 
  - 20 property-based tests covering universal correctness properties
  - All property tests marked as optional (`*`) but highly recommended for quality assurance
  - Each property test validates specific requirements from design document
  
- **Estimated Effort**: 
  - All tasks sized to 2-4 hours for manageable implementation
  - Total estimated effort: ~220-280 hours
  - Can be completed in 6-8 weeks with 1 full-time developer
  
- **Checkpoints**: 
  - 11 checkpoint tasks after each phase
  - Allow for incremental validation and course correction
  - User can provide feedback at each checkpoint
  
- **Spanish Language**: 
  - All user-facing text must be in Spanish (primary language)
  - English translations available via language toggle
  - All mock data in Spanish with Mexican context
  
- **Accessibility**: 
  - WCAG 2.1 Level AA compliance is mandatory
  - Keyboard navigation for all interactive elements
  - Screen reader support throughout
  - Color contrast ratios verified
  
- **Responsive Design**: 
  - Mobile-first approach (320px minimum)
  - Three breakpoints: mobile (320-767px), tablet (768-1023px), desktop (1024px+)
  - All features must work on all screen sizes
  
- **Mock Data**: 
  - 5 student personas with realistic EBC data
  - 20+ opportunities across 6 types
  - Spanish language content
  - Mexican banking education context

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "2.5", "3.1", "3.3", "3.5"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "3.7", "4.1"] },
    { "id": 4, "tasks": ["3.8", "3.9", "4.2", "4.3", "6.1"] },
    { "id": 5, "tasks": ["4.4", "4.5", "4.6", "4.7", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["4.8", "4.9", "5.1", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12"] },
    { "id": 7, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "6.13", "6.14", "6.15", "7.1", "7.2"] },
    { "id": 8, "tasks": ["5.7", "5.8", "7.3", "7.4", "7.5", "7.6", "7.7", "8.1", "8.3", "8.4"] },
    { "id": 9, "tasks": ["5.9", "7.8", "7.9", "8.2", "8.5", "8.6", "8.7", "8.8", "8.9"] },
    { "id": 10, "tasks": ["8.10", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 11, "tasks": ["9.6", "9.7", "9.8", "9.9", "9.10"] },
    { "id": 12, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 13, "tasks": ["10.4", "10.5", "10.6", "10.7"] },
    { "id": 14, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 15, "tasks": ["11.7", "11.8", "11.9", "11.10", "11.11"] }
  ]
}
```
