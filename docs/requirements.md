# Requirements Document

## Introduction

EBC Compass is a personalized academic and professional guidance system for students at Escuela Bancaria y Comercial (EBC), a Mexican banking and commercial school. The system provides students with tailored recommendations for academic courses, scholarships, professional development opportunities, industry events, administrative procedures, and career opportunities based on their individual profiles, academic progress, and professional interests in banking, finance, marketing, and business administration.

The system features a student profile management interface, an interactive dashboard displaying academic progress and personalized recommendations, a conversational bilingual assistant (Spanish/English), a comprehensive opportunities catalog, and an integrated calendar with deadline alerts. EBC Compass aims to help students navigate their academic journey, discover relevant opportunities, and achieve their professional goals in the banking and finance sectors.

## Glossary

- **EBC_Compass**: The personalized academic and professional guidance system
- **Student**: A user enrolled at Escuela Bancaria y Comercial
- **Student_Profile**: Collection of student data including name, campus, career, semester, completed courses, interests, and goals
- **Campus**: Physical EBC location (e.g., Ciudad de México, Guadalajara, Monterrey)
- **Career**: Academic program (e.g., Banking, Finance, Marketing, Business Administration)
- **Course**: Academic subject with a unique course code and name
- **Completed_Course**: A course the student has successfully finished
- **Pending_Course**: A required course the student has not yet completed
- **Semester**: Academic term number (1-10)
- **Opportunity**: A recommendable item from one of six types: Course, Scholarship, Professional Development, Event, Procedure, or Career Opportunity
- **Recommendation_Engine**: The component that generates personalized opportunity suggestions
- **Dashboard**: The main interface displaying academic progress and recommendations
- **Conversational_Assistant**: The bilingual rule-based chatbot component
- **Academic_Progress**: Calculated metric showing completed courses versus total required courses
- **Eligibility_Criteria**: Requirements that must be met to qualify for an opportunity
- **Prerequisite**: A course that must be completed before enrolling in another course
- **Alert**: A time-sensitive notification about deadlines or important dates
- **Profile_Completeness**: Measure of required profile fields that have been filled
- **Opportunity_Catalog**: Repository of all available opportunities with metadata
- **Response_Time**: Time elapsed between user action and system response

## Requirements

### Requirement RF-01: Student Profile Management

**User Story:** As a student, I want to create and maintain my academic profile, so that the system can provide personalized recommendations relevant to my situation and goals.

#### Acceptance Criteria

1. THE EBC_Compass SHALL capture the Student name as text input
2. THE EBC_Compass SHALL provide a Campus selection interface with available EBC campus locations
3. THE EBC_Compass SHALL provide a Career selection interface with available academic programs (Banking, Finance, Marketing, Business Administration)
4. THE EBC_Compass SHALL accept Current_Semester as a numeric input between 1 and 10
5. THE EBC_Compass SHALL allow the Student to add Completed_Courses with course codes and course names
6. THE EBC_Compass SHALL allow the Student to add Pending_Courses with course codes and course names
7. THE EBC_Compass SHALL accept business and finance interests as tags or free text
8. THE EBC_Compass SHALL accept professional goals in banking, finance, and business as free text
9. THE EBC_Compass SHALL allow the Student to specify availability preferences for activities and events
10. THE EBC_Compass SHALL save Student_Profile data
11. THE EBC_Compass SHALL allow the Student to edit Student_Profile data after initial creation
12. THE EBC_Compass SHALL calculate Profile_Completeness based on required fields (name, campus, career, semester)
13. WHEN Profile_Completeness is below 100%, THE EBC_Compass SHALL display a prompt to complete the profile

### Requirement RF-02: Academic Progress Dashboard

**User Story:** As a student, I want to view my academic progress and receive actionable recommendations on my dashboard, so that I can stay informed about my next steps and opportunities.

#### Acceptance Criteria

1. THE Dashboard SHALL display Academic_Progress as a visual representation comparing completed courses to total required courses
2. THE Dashboard SHALL display Current_Semester progression
3. THE Dashboard SHALL display recommended next academic steps including courses to enroll
4. THE Dashboard SHALL display recommended administrative procedures to complete
5. THE Dashboard SHALL display important dates including enrollment periods, deadlines, and exams
6. THE Dashboard SHALL display a personalized opportunities feed with scholarships, events, and courses
7. THE Dashboard SHALL refresh recommendations when Student_Profile is updated
8. THE Dashboard SHALL display content in Spanish as the primary language
9. THE Dashboard SHALL be responsive and optimized for mobile devices
10. WHEN the Student has no Completed_Courses, THE Dashboard SHALL display onboarding guidance

### Requirement RF-03: Personalized Recommendation Engine

**User Story:** As a student, I want to receive personalized recommendations for courses, scholarships, events, and opportunities, so that I can discover relevant options that match my profile and goals.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL generate academic course recommendations based on Career requirements
2. THE Recommendation_Engine SHALL generate academic course recommendations based on Current_Semester
3. THE Recommendation_Engine SHALL generate academic course recommendations based on Completed_Courses and Prerequisites
4. THE Recommendation_Engine SHALL generate scholarship recommendations based on Eligibility_Criteria matching Student_Profile
5. THE Recommendation_Engine SHALL generate professional development course recommendations based on Career and interests
6. THE Recommendation_Engine SHALL generate industry event recommendations based on Career field and interests
7. THE Recommendation_Engine SHALL generate administrative procedure recommendations based on Current_Semester and pending requirements
8. THE Recommendation_Engine SHALL generate career opportunity recommendations based on Career, Completed_Courses, and professional goals
9. THE Recommendation_Engine SHALL not recommend courses where Prerequisites have not been met
10. THE Recommendation_Engine SHALL not recommend scholarships where Eligibility_Criteria are not satisfied
11. THE Recommendation_Engine SHALL prioritize recommendations by relevance score
12. WHEN Student_Profile is incomplete, THE Recommendation_Engine SHALL generate limited recommendations based on available data
13. THE Recommendation_Engine SHALL update recommendations within 2 seconds after Student_Profile changes

### Requirement RF-04: Calendar and Alert System

**User Story:** As a student, I want to view important dates in a calendar and receive timely alerts about deadlines, so that I don't miss critical enrollment periods or opportunities.

#### Acceptance Criteria

1. THE EBC_Compass SHALL display important dates in a calendar view
2. THE EBC_Compass SHALL display enrollment periods in the calendar
3. THE EBC_Compass SHALL display procedure deadlines in the calendar
4. THE EBC_Compass SHALL display scholarship application deadlines in the calendar
5. THE EBC_Compass SHALL display upcoming events in the calendar
6. THE EBC_Compass SHALL display exam dates in the calendar
7. WHEN an important deadline is 7 days away or less, THE EBC_Compass SHALL generate an Alert
8. WHEN an enrollment period opens, THE EBC_Compass SHALL generate an Alert
9. WHEN a scholarship application deadline approaches, THE EBC_Compass SHALL generate an Alert
10. THE EBC_Compass SHALL display Alerts prominently on the Dashboard
11. THE EBC_Compass SHALL allow the Student to dismiss Alerts
12. THE EBC_Compass SHALL display calendar content in Spanish

### Requirement RF-05: Conversational Bilingual Assistant

**User Story:** As a student, I want to ask questions in Spanish or English and receive helpful context-aware answers, so that I can quickly get information about courses, scholarships, procedures, and requirements.

#### Acceptance Criteria

1. THE Conversational_Assistant SHALL accept text input in Spanish
2. THE Conversational_Assistant SHALL accept text input in English
3. THE Conversational_Assistant SHALL respond in the same language as the user input
4. THE Conversational_Assistant SHALL use fuzzy keyword matching to understand queries
5. THE Conversational_Assistant SHALL provide context-aware responses based on Student Career
6. THE Conversational_Assistant SHALL provide context-aware responses based on Current_Semester
7. THE Conversational_Assistant SHALL provide context-aware responses based on Completed_Courses
8. THE Conversational_Assistant SHALL explain course Prerequisites when asked
9. THE Conversational_Assistant SHALL explain scholarship Eligibility_Criteria when asked
10. THE Conversational_Assistant SHALL explain administrative procedure steps when asked
11. THE Conversational_Assistant SHALL use rule-based logic only, without machine learning models
12. THE Conversational_Assistant SHALL respond within 2 seconds
13. WHEN the Conversational_Assistant cannot understand a query, THE Conversational_Assistant SHALL provide suggested alternative questions
14. WHEN the Conversational_Assistant lacks information to answer, THE Conversational_Assistant SHALL direct the Student to relevant EBC resources

### Requirement RF-06: Opportunities Catalog

**User Story:** As a student, I want to browse a comprehensive catalog of opportunities with filtering options, so that I can explore all available courses, scholarships, events, and career opportunities.

#### Acceptance Criteria

1. THE Opportunity_Catalog SHALL contain Course opportunities with course codes, names, Prerequisites, and semester availability
2. THE Opportunity_Catalog SHALL contain Scholarship opportunities with Eligibility_Criteria, deadlines, and award amounts
3. THE Opportunity_Catalog SHALL contain Professional Development opportunities with descriptions, providers, and certification details
4. THE Opportunity_Catalog SHALL contain Event opportunities with dates, locations, and registration information
5. THE Opportunity_Catalog SHALL contain Procedure opportunities with required documents, deadlines, and step-by-step instructions
6. THE Opportunity_Catalog SHALL contain Career Opportunity items with job titles, employers, requirements, and application links
7. THE Opportunity_Catalog SHALL allow filtering by opportunity type
8. THE Opportunity_Catalog SHALL allow filtering by Career relevance
9. THE Opportunity_Catalog SHALL allow filtering by Semester relevance
10. THE Opportunity_Catalog SHALL allow keyword search across all opportunity fields
11. THE Opportunity_Catalog SHALL display opportunities in Spanish
12. THE Opportunity_Catalog SHALL indicate which opportunities are recommended for the Student
13. WHEN an Opportunity has a deadline, THE Opportunity_Catalog SHALL display days remaining

### Requirement NF-01: Performance and Responsiveness

**User Story:** As a student, I want the system to respond quickly and work smoothly on my mobile device, so that I can access information efficiently wherever I am.

#### Acceptance Criteria

1. THE EBC_Compass SHALL respond to user actions within 2 seconds
2. THE EBC_Compass SHALL load the Dashboard within 3 seconds on 4G mobile connections
3. THE EBC_Compass SHALL render correctly on mobile devices with screen widths from 320px to 428px
4. THE EBC_Compass SHALL render correctly on tablet devices with screen widths from 768px to 1024px
5. THE EBC_Compass SHALL render correctly on desktop devices with screen widths from 1280px and above
6. THE EBC_Compass SHALL use responsive design patterns for mobile-first experience
7. THE EBC_Compass SHALL optimize images and assets for mobile bandwidth constraints

### Requirement NF-02: Language and Accessibility

**User Story:** As a student, I want the system to be accessible, easy to use, and primarily in Spanish, so that I can navigate it comfortably regardless of my abilities or preferences.

#### Acceptance Criteria

1. THE EBC_Compass SHALL display Spanish as the primary interface language
2. THE EBC_Compass SHALL provide English as a secondary language option
3. THE EBC_Compass SHALL meet WCAG 2.1 Level AA accessibility standards
4. THE EBC_Compass SHALL support keyboard navigation for all interactive elements
5. THE EBC_Compass SHALL provide alternative text for all images
6. THE EBC_Compass SHALL maintain color contrast ratios of at least 4.5:1 for normal text
7. THE EBC_Compass SHALL provide visible focus indicators for interactive elements
8. THE EBC_Compass SHALL support screen reader navigation

### Requirement NF-03: Privacy and Data Handling

**User Story:** As a student, I want my personal and academic information to be handled securely and privately, so that I can trust the system with my data.

#### Acceptance Criteria

1. THE EBC_Compass SHALL collect only data necessary for recommendations and profile functionality
2. THE EBC_Compass SHALL store Student_Profile data securely
3. THE EBC_Compass SHALL not share Student data with third parties without explicit consent
4. THE EBC_Compass SHALL allow Students to export their Student_Profile data
5. THE EBC_Compass SHALL allow Students to delete their Student_Profile data
6. THE EBC_Compass SHALL display a privacy policy explaining data collection and usage
7. WHEN a Student creates a profile, THE EBC_Compass SHALL obtain consent for data collection

### Requirement BR-01: Business Rules for Course Recommendations

**User Story:** As a student, I want course recommendations to respect academic requirements, so that I only see courses I'm eligible to take.

#### Acceptance Criteria

1. WHEN a Course has Prerequisites, THE Recommendation_Engine SHALL not recommend the Course unless all Prerequisites are in Completed_Courses
2. WHEN a Course is offered only in specific semesters, THE Recommendation_Engine SHALL only recommend the Course during appropriate semesters
3. WHEN a Course is in Completed_Courses, THE Recommendation_Engine SHALL not recommend the Course again
4. WHEN a Course is required for the Student Career, THE Recommendation_Engine SHALL prioritize the Course higher than elective courses
5. THE Recommendation_Engine SHALL calculate prerequisite chains to recommend optimal course sequences

### Requirement BR-02: Business Rules for Scholarship Recommendations

**User Story:** As a student, I want scholarship recommendations to match my eligibility, so that I don't waste time applying for scholarships I cannot receive.

#### Acceptance Criteria

1. WHEN a Scholarship has minimum GPA requirements, THE Recommendation_Engine SHALL only recommend the Scholarship if eligibility is met
2. WHEN a Scholarship is Career-specific, THE Recommendation_Engine SHALL only recommend the Scholarship to Students in matching Careers
3. WHEN a Scholarship has Semester requirements, THE Recommendation_Engine SHALL only recommend the Scholarship to Students in eligible semesters
4. WHEN a Scholarship has Campus restrictions, THE Recommendation_Engine SHALL only recommend the Scholarship to Students at eligible campuses
5. WHEN a Scholarship application deadline has passed, THE Recommendation_Engine SHALL not recommend the Scholarship

### Requirement BR-03: Business Rules for Progress Calculation

**User Story:** As a student, I want my academic progress to be calculated accurately, so that I can track my advancement toward graduation.

#### Acceptance Criteria

1. THE EBC_Compass SHALL calculate Academic_Progress as (number of Completed_Courses ÷ total required courses for Career) × 100
2. WHEN total required courses for Career is unknown, THE EBC_Compass SHALL display Academic_Progress based on semester progression
3. THE EBC_Compass SHALL display Academic_Progress as a percentage
4. THE EBC_Compass SHALL update Academic_Progress immediately when Completed_Courses changes
5. THE EBC_Compass SHALL display expected graduation semester based on Current_Semester and Academic_Progress

### Requirement BR-04: Business Rules for Alert Generation

**User Story:** As a student, I want alerts to be timely and relevant, so that I receive important notifications without being overwhelmed.

#### Acceptance Criteria

1. WHEN a deadline is 7 days away, THE EBC_Compass SHALL generate an Alert
2. WHEN a deadline is 3 days away, THE EBC_Compass SHALL generate a high-priority Alert
3. WHEN a deadline is 1 day away, THE EBC_Compass SHALL generate an urgent Alert
4. THE EBC_Compass SHALL not generate duplicate Alerts for the same deadline
5. WHEN the Student dismisses an Alert, THE EBC_Compass SHALL not display the Alert again unless it becomes more urgent
6. THE EBC_Compass SHALL limit Alert display to a maximum of 5 concurrent Alerts on the Dashboard

### Requirement BR-05: Business Rules for Profile Completeness

**User Story:** As a student, I want to understand what profile information is required, so that I can complete my profile and receive better recommendations.

#### Acceptance Criteria

1. THE EBC_Compass SHALL require name, Campus, Career, and Current_Semester as minimum profile fields
2. THE EBC_Compass SHALL calculate Profile_Completeness as (filled required fields ÷ total required fields) × 100
3. WHEN Profile_Completeness is below 100%, THE EBC_Compass SHALL display missing required fields
4. WHEN Profile_Completeness reaches 100%, THE EBC_Compass SHALL enable full recommendation functionality
5. THE EBC_Compass SHALL identify Completed_Courses, interests, and goals as optional fields that enhance recommendations

## Mock Data Requirements

### Student Personas

The system shall include 3-5 representative student personas:

1. **Banking Career Student** - Early semester (1-3), minimal completed courses, interested in corporate banking
2. **Finance Career Student** - Mid semester (4-6), moderate course completion, interested in investment banking
3. **Marketing Career Student** - Mid semester (4-6), moderate course completion, interested in digital marketing
4. **Business Administration Student** - Late semester (7-9), high course completion, interested in entrepreneurship
5. **Returning Student** - Variable semester, transferred credits, interested in fintech

### Opportunity Data

The system shall include at least 20 opportunities distributed across six types:

- **Courses**: At least 5 academic courses with realistic course codes, prerequisites, and semester offerings
- **Scholarships**: At least 3 scholarships with eligibility criteria, deadlines, and award amounts
- **Professional Development**: At least 3 certification programs or skill courses (e.g., financial analysis, Excel, banking regulations)
- **Events**: At least 4 industry events (banking conferences, career fairs, networking sessions, workshops)
- **Procedures**: At least 3 administrative procedures (enrollment, transcript requests, scholarship applications)
- **Career Opportunities**: At least 2 internships or job postings in banking/finance sectors

All opportunity content shall use Spanish language for user-facing fields and reflect realistic Mexican banking and commercial education context.

## Open Questions and Assumptions

### Assumptions
1. **Course catalog structure**: Assuming each Career has a defined set of required courses and electives with known prerequisite chains
2. **GPA tracking**: Assuming the system does not calculate GPA internally but may receive it as optional profile data for scholarship matching
3. **Authentication**: Assuming authentication and authorization are handled by an external EBC system
4. **Campus list**: Assuming EBC provides an authoritative list of campus locations
5. **Career programs**: Assuming the four main careers (Banking, Finance, Marketing, Business Administration) with potential for expansion
6. **Opportunity sources**: Assuming opportunity data is curated by EBC administrators rather than auto-imported from external systems
7. **Offline functionality**: Requirements focus on online functionality; PWA capabilities are noted as future consideration
8. **Integration**: Assuming EBC Compass operates as a standalone system without integration to existing EBC academic systems in initial version

### Open Questions (Requiring EBC Policy Clarification)
1. **Course prerequisites**: What is the complete prerequisite structure for each Career program?
2. **Total required courses**: How many total courses are required for graduation in each Career?
3. **Scholarship policies**: What are the specific eligibility criteria for each scholarship program?
4. **Enrollment rules**: Are there specific enrollment windows, waitlist policies, or course capacity constraints?
5. **Data retention**: How long should student profile data be retained after graduation or withdrawal?
6. **Academic calendar**: What are the official semester dates, enrollment periods, and examination schedules?
7. **Campus offerings**: Are all courses offered at all campuses, or are there campus-specific course catalogs?
8. **Transfer credits**: How should transfer credits from other institutions be handled in progress calculations?
9. **Grade requirements**: Are there minimum grade thresholds for course completion beyond pass/fail?
10. **Professional development certification**: Which external certifications does EBC recognize or recommend for each Career?

## Prioritization (MoSCoW)

### Must Have
- RF-01: Student Profile Management (all criteria)
- RF-02: Academic Progress Dashboard (criteria 1, 2, 3, 5, 6, 8, 9)
- RF-03: Personalized Recommendation Engine (all criteria)
- RF-04: Calendar and Alert System (criteria 1-10)
- RF-05: Conversational Bilingual Assistant (criteria 1-7, 12)
- RF-06: Opportunities Catalog (criteria 1-6, 11)
- NF-01: Performance and Responsiveness (criteria 1, 3, 4, 5, 6)
- NF-02: Language and Accessibility (criteria 1, 2, 3, 4, 5)
- BR-01, BR-02, BR-03, BR-04, BR-05: All business rules

### Should Have
- RF-02: Academic Progress Dashboard (criteria 4, 7, 10)
- RF-04: Calendar and Alert System (criteria 11, 12)
- RF-05: Conversational Bilingual Assistant (criteria 8-11, 13, 14)
- RF-06: Opportunities Catalog (criteria 7-10, 12, 13)
- NF-01: Performance and Responsiveness (criteria 2, 7)
- NF-02: Language and Accessibility (criteria 6, 7, 8)
- NF-03: Privacy and Data Handling (all criteria)

### Could Have
- Advanced filtering in Opportunity_Catalog
- Integration with external calendar applications
- Mobile app notifications
- Recommendation explanation feature (why this was recommended)
- Social features (peer connections, study groups)
- Multi-language support beyond Spanish and English

### Won't Have (Initial Release)
- Automatic GPA calculation
- Direct enrollment capability (external to EBC systems)
- Payment processing for fees or applications
- Document upload and storage
- Video content delivery
- Real-time chat with advisors
- Integration with external job boards
- Automated course registration
