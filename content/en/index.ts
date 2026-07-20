import type { SiteContent } from "../types";

export const enContent = {
  locale: "en",
  shared: {
    siteName: "HELP Math",
    siteTagline: "Math language made visible",
    skipToContent: "Skip to main content",
    statusLabel: "Modernization in progress",
    statusMessage:
      "HELP Math is being carefully restored for today’s web. Public demos and support are available; student accounts are not yet active.",
    externalLinkLabel: "Opens in a new tab",
    requiredFieldLabel: "Required",
    navigation: {
      ariaLabel: "Main navigation",
      homeLabel: "HELP Math home",
      links: [
        { label: "About", href: "/about" },
        { label: "Approach", href: "/approach" },
        { label: "Curriculum", href: "/curriculum" },
        { label: "Research", href: "/research" },
        { label: "Resources", href: "/resources" },
        { label: "Demos", href: "/demos" },
      ],
      supportAction: { label: "Get support", href: "/support" },
      languageLabel: "Language",
      languageNames: { en: "English", es: "Español" },
      openMenuLabel: "Open navigation",
      closeMenuLabel: "Close navigation",
    },
    footer: {
      summary:
        "HELP Math brings mathematical ideas and academic language together for multilingual learners and students who benefit from added support.",
      exploreLabel: "Explore",
      helpLabel: "Help and policies",
      exploreLinks: [
        { label: "Our approach", href: "/approach" },
        { label: "Curriculum", href: "/curriculum" },
        { label: "Research archive", href: "/research" },
        { label: "JavaScript demos", href: "/demos" },
      ],
      helpLinks: [
        { label: "Support", href: "/support" },
        { label: "Contact", href: "/contact" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
      languageNote: "Site content is available in English and Spanish.",
      legalNote:
        "HELP Math is in active restoration. Historical program descriptions are identified as archival context, not current product promises.",
    },
  },
  pages: {
    home: {
      metadata: {
        title: "Math language made visible",
        description:
          "Meet the modern HELP Math project: bilingual math support, research context, restored interactive demonstrations, and help for returning educators and students.",
      },
      hero: {
        eyebrow: "Welcome back to HELP Math",
        title: "See the language inside every math idea.",
        summary:
          "HELP Math connects visual models, clear explanations, academic vocabulary, and guided practice so multilingual learners can make sense of both the mathematics and the words used to describe it.",
        primaryAction: { label: "Explore the demos", href: "/demos" },
        secondaryAction: { label: "Get project support", href: "/support" },
        supportingNote:
          "The new website is a public preview. Restored activities are for demonstration while the wider learning platform is evaluated.",
      },
      status: {
        label: "Project status",
        title: "A careful rebuild—not a copy of an old website",
        body:
          "We are preserving HELP Math’s instructional ideas while replacing legacy delivery technology with accessible, maintainable web experiences. Accounts, assignments, and student progress records are not part of this launch.",
        action: { label: "Read the modernization status", href: "/about#today" },
      },
      audiences: {
        eyebrow: "Built around real learning needs",
        title: "A clearer path into mathematical meaning",
        intro:
          "Different learners need different entry points. HELP Math’s restored public experience focuses on explanation, language, and supportive representations.",
        cards: [
          {
            id: "multilingual-learners",
            title: "For multilingual learners",
            description:
              "Connect everyday language, academic vocabulary, symbols, and visual models without lowering the mathematical goal.",
          },
          {
            id: "students-needing-support",
            title: "For students who need another route",
            description:
              "Break complex ideas into visible, paced steps and offer multiple ways to notice relationships and patterns.",
          },
          {
            id: "educators",
            title: "For educators",
            description:
              "Review the instructional approach, explore restored examples, and help shape responsible next steps for the project.",
          },
        ],
      },
      approach: {
        eyebrow: "How HELP Math teaches",
        title: "Words, representations, and reasoning work together",
        intro:
          "The historic program paired mathematics instruction with language supports. The modernization keeps that core idea visible in every restored activity.",
        cards: [
          {
            id: "make-language-explicit",
            title: "Make language explicit",
            description:
              "Introduce key terms in context and connect them to symbols, actions, diagrams, and examples.",
          },
          {
            id: "show-relationships",
            title: "Show relationships",
            description:
              "Use animation and manipulable representations to reveal what changes, what stays the same, and why.",
          },
          {
            id: "pace-the-thinking",
            title: "Pace the thinking",
            description:
              "Segment explanations into purposeful steps so learners can attend to one relationship at a time.",
          },
        ],
        action: { label: "See the instructional approach", href: "/approach" },
      },
      demos: {
        eyebrow: "Restored learning objects",
        title: "Try two early JavaScript demonstrations",
        intro:
          "These small activities show how legacy HELP Math material can become crisp, browser-native, keyboard-friendly learning experiences.",
        items: [
          {
            id: "conversion-1-2",
            title: "Conversion 1.2",
            description:
              "Explore a carefully reconstructed sequence with deterministic timing and responsive vector graphics.",
            detail: "Modern JavaScript demonstration",
            action: { label: "Open Conversion 1.2", href: "/demos/conversion-1-2" },
          },
          {
            id: "conversion-1-4",
            title: "Conversion 1.4",
            description:
              "View another restored activity and compare how motion, labels, and replay behavior support explanation.",
            detail: "Modern JavaScript demonstration",
            action: { label: "Open Conversion 1.4", href: "/demos/conversion-1-4" },
          },
        ],
        note:
          "A demo is published only after its source, timeline, behavior, and key visual states have been reviewed. Demos do not collect student work.",
      },
      closing: {
        title: "Returning to HELP Math? We want to point you in the right direction.",
        body:
          "Tell us whether you are looking for an old account, program materials, research information, or a future collaboration. Please do not include student records or passwords.",
        action: { label: "Contact the project", href: "/contact" },
      },
    },
    about: {
      metadata: {
        title: "About HELP Math",
        description:
          "Learn what HELP Math was designed to do, what is being preserved, and what the current modernization does and does not include.",
      },
      hero: {
        eyebrow: "About the project",
        title: "Preserving an instructional idea worth rebuilding",
        summary:
          "HELP Math—historically short for Help with English Language Proficiency—was designed to develop mathematical understanding alongside the academic language students need to participate in math learning.",
        primaryAction: { label: "Explore our approach", href: "/approach" },
        secondaryAction: { label: "View the research archive", href: "/research" },
      },
      story: [
        {
          id: "purpose",
          eyebrow: "The original purpose",
          title: "Mathematics and language belong in the same lesson",
          paragraphs: [
            "Historic HELP Math materials describe a web-based intervention for English learners and other students who benefit from additional mathematics support.",
            "Its distinctive instructional goal was not simply to translate directions. Lessons connected mathematical concepts with academic vocabulary, visual models, spoken and written explanations, guided practice, and bilingual support.",
          ],
        },
        {
          id: "preservation",
          eyebrow: "What we are preserving",
          title: "Instructional structure before technical nostalgia",
          paragraphs: [
            "The project archive includes lesson sources, interactive media, program descriptions, and research materials from different periods of HELP Math’s history.",
            "The restoration treats those files as evidence. It preserves meaningful explanations, pacing, language supports, and learner interactions while replacing obsolete browser technology.",
          ],
        },
        {
          id: "today",
          eyebrow: "Where we are today",
          title: "A public website and demonstration phase",
          paragraphs: [
            "This release introduces the project, makes selected evidence easier to review, and publishes a small set of review-stage JavaScript demonstrations.",
            "It is not yet a replacement for the former learning platform. There are no active student accounts, classes, assignments, purchases, or progress reports on this site.",
          ],
        },
      ],
      principles: {
        eyebrow: "Modernization principles",
        title: "What guides each decision",
        cards: [
          {
            id: "evidence",
            title: "Evidence before claims",
            description:
              "We separate dated historical records from claims that have been independently verified for present use.",
          },
          {
            id: "access",
            title: "Access by design",
            description:
              "Responsive layouts, keyboard use, readable contrast, text alternatives, and reduced motion are part of the build—not an afterthought.",
          },
          {
            id: "language",
            title: "Language with dignity",
            description:
              "Bilingual and academic-language supports should expand access to rigorous ideas, never signal lower expectations.",
          },
          {
            id: "privacy",
            title: "Student privacy first",
            description:
              "The public launch collects no student learning data and does not ask learners to create accounts.",
          },
        ],
      },
      today: {
        title: "Help us understand how HELP Math was used",
        body:
          "Former educators, partners, and researchers can share non-confidential context about the program’s history. Please do not send student names, records, credentials, or copyrighted materials you are not authorized to share.",
        action: { label: "Contact the restoration team", href: "/contact?topic=project-history" },
      },
    },
    approach: {
      metadata: {
        title: "Instructional Approach",
        description:
          "See how HELP Math combines academic language, visual representations, paced explanations, and bilingual supports around rigorous mathematical ideas.",
      },
      hero: {
        eyebrow: "Instructional approach",
        title: "Make the mathematics—and its language—easier to see",
        summary:
          "HELP Math’s archived design draws on sheltered instruction: make meaning explicit, connect language to representations, segment complex reasoning, and give learners supported opportunities to engage with the same mathematical goal.",
        primaryAction: { label: "Try a restored demo", href: "/demos" },
        secondaryAction: { label: "Review curriculum context", href: "/curriculum" },
      },
      foundations: {
        eyebrow: "Four foundations",
        title: "Support that stays connected to the idea",
        intro:
          "Each layer should help a learner reason—not decorate the screen or replace productive thinking.",
        cards: [
          {
            id: "academic-language",
            title: "Academic language in context",
            description:
              "Define and revisit terms where they do mathematical work, linking words such as equivalent, convert, and represent to visible relationships.",
          },
          {
            id: "multiple-representations",
            title: "Multiple representations",
            description:
              "Coordinate numbers, symbols, diagrams, manipulatives, and spoken or written explanations so learners can connect forms of meaning.",
          },
          {
            id: "segmentation",
            title: "Purposeful segmentation",
            description:
              "Break explanations into coherent beats, control the pace, and leave enough time to notice the relationship under discussion.",
          },
          {
            id: "bilingual-support",
            title: "Bilingual support",
            description:
              "Use Spanish support as a bridge to understanding while keeping important English academic terms visible and meaningful.",
          },
        ],
      },
      learningSequence: {
        eyebrow: "A learning sequence",
        title: "From orientation to independent reasoning",
        intro:
          "Exact lesson patterns vary, but the restored experience follows a transparent instructional arc.",
        steps: [
          {
            id: "orient",
            step: "01",
            title: "Orient",
            description:
              "Name the goal, activate useful prior knowledge, and introduce the language learners will need.",
          },
          {
            id: "model",
            step: "02",
            title: "Model",
            description:
              "Make a relationship visible through a worked example, coordinated representations, and a concise explanation.",
          },
          {
            id: "interact",
            step: "03",
            title: "Interact",
            description:
              "Let learners predict, replay, manipulate, or compare so attention stays on the mathematical structure.",
          },
          {
            id: "practice",
            step: "04",
            title: "Practice and explain",
            description:
              "Move toward independent work while inviting learners to use the target language to describe their reasoning.",
          },
        ],
      },
      supportLayers: {
        id: "support-layers",
        eyebrow: "Available support",
        title: "Layer support without hiding the mathematics",
        paragraphs: [
          "A modern activity may combine concise text, narration, visual emphasis, a glossary connection, Spanish language support, replay, and learner-controlled pacing.",
          "Not every activity needs every support. The goal is to make each support purposeful, perceivable, and removable when a learner no longer needs it.",
        ],
        bullets: [
          "Keep labels close to the representations they describe.",
          "Use motion to explain change, not to compete for attention.",
          "Offer pause and replay without changing the instructional sequence.",
          "Write Spanish and English as complete learning experiences, not word-for-word interface fragments.",
        ],
      },
      teacherRole: {
        title: "Technology supports instruction; educators shape its use.",
        body:
          "The public demos show learning objects, not a complete course or an automated teaching system. Educators remain essential for choosing appropriate tasks, listening to student reasoning, and connecting activities to classroom goals.",
        action: { label: "Ask an instructional question", href: "/contact?topic=instruction" },
      },
    },
    curriculum: {
      metadata: {
        title: "Curriculum",
        description:
          "Explore the historical HELP Math curriculum domains, lesson flow, and the limits of the material currently available on the modern site.",
      },
      hero: {
        eyebrow: "Curriculum context",
        title: "A broad archive, returning one carefully reviewed piece at a time",
        summary:
          "Historic materials describe HELP Math configurations for upper-elementary and middle-grade mathematics, with additional uses for remediation. The current website publishes selected demonstrations—not the full historical curriculum.",
        primaryAction: { label: "View current demos", href: "/demos" },
        secondaryAction: { label: "Request curriculum information", href: "/contact?topic=curriculum" },
      },
      archiveNotice: {
        title: "Why we do not publish a single lesson or hour count",
        body:
          "Archived documents describe different editions and proposed scopes, including grade 3–8 and grade 6–8 configurations. Those records are being reconciled before any current catalog, standards alignment, or availability claim is published.",
      },
      domains: {
        eyebrow: "Historical content domains",
        title: "Mathematical ideas represented in the archive",
        intro:
          "The archive includes work across four broad domains. Coverage and sequence vary by historical edition and remain under audit.",
        cards: [
          {
            id: "numbers",
            title: "Numbers and operations",
            description:
              "Place value, number relationships, fractions, decimals, proportional reasoning, and operations represented with language and visual models.",
          },
          {
            id: "geometry",
            title: "Geometry and measurement",
            description:
              "Properties, spatial relationships, units, measurement, and geometric reasoning made visible through diagrams and manipulation.",
          },
          {
            id: "algebra",
            title: "Patterns and algebraic thinking",
            description:
              "Patterns, variables, expressions, equations, and the language used to describe general relationships.",
          },
          {
            id: "data",
            title: "Data and probability",
            description:
              "Reading, representing, comparing, and reasoning from data using coordinated graphs, quantities, and explanations.",
          },
        ],
      },
      lessonFlow: {
        eyebrow: "Learning-object design",
        title: "How a restored lesson can unfold",
        steps: [
          {
            id: "goal-language",
            step: "1",
            title: "Set the goal and language",
            description:
              "Clarify the mathematical purpose, relevant prior knowledge, and words learners will encounter.",
          },
          {
            id: "concept-development",
            step: "2",
            title: "Develop the concept",
            description:
              "Use synchronized representations and paced examples to reveal a key relationship.",
          },
          {
            id: "guided-application",
            step: "3",
            title: "Apply with support",
            description:
              "Provide meaningful choices, feedback, replay, and language scaffolds during practice.",
          },
          {
            id: "reflect-check",
            step: "4",
            title: "Reflect and check",
            description:
              "Invite explanation and check understanding without treating one interaction as a full measure of mastery.",
          },
        ],
      },
      availability: {
        id: "availability",
        eyebrow: "What is available now",
        title: "Demonstrations, not enrollment",
        paragraphs: [
          "The modern site currently offers public learning-object demonstrations and project information. It does not provide full lessons, placement testing, teacher dashboards, class assignments, or student progress storage.",
          "Future curriculum publication depends on source audit, rights review, instructional review, accessibility work, and validation against original behavior.",
        ],
      },
      closing: {
        title: "Looking for a specific lesson or historical scope document?",
        body:
          "Send an adult contact request with the topic and intended use. We will confirm what can be shared and whether an accessible copy is available.",
        action: { label: "Request curriculum information", href: "/contact?topic=curriculum" },
      },
    },
    research: {
      metadata: {
        title: "Research and Evidence Archive",
        description:
          "Review dated HELP Math research context, archival records, and the evidence standards guiding the project’s current public claims.",
      },
      hero: {
        eyebrow: "Research and evidence",
        title: "Keep the history visible—and the claims precise",
        summary:
          "HELP Math’s archive includes research descriptions, grant materials, reviews, and awards from different periods. This page identifies them as historical evidence until each source and its present-day relevance can be independently checked.",
        primaryAction: { label: "Request a source", href: "/contact?topic=research" },
        secondaryAction: { label: "Read about the project", href: "/about" },
      },
      evidenceNotice: {
        title: "An archived statement is not a current effectiveness claim",
        body:
          "Dates, study populations, comparison conditions, outcome measures, product versions, and original reports matter. We do not reuse phrases such as “only,” “leading,” “highest rated,” or “research proven” without current, directly reviewable support.",
      },
      entriesLabel: "Evidence register",
      entries: [
        {
          id: "program-description-2014",
          title: "About HELP Math program description",
          dateLabel: "Archived document created in 2014",
          status: "archived",
          statusLabel: "Archived context",
          summary:
            "A program overview describing HELP Math’s intended learners, academic-language supports, lesson design, historical curriculum scale, and research narrative.",
          interpretation:
            "Useful for understanding design intent. Specific counts and outcome statements require confirmation against the edition and underlying primary sources.",
          sourceLabel: "Local archive: About HELP Math.pdf",
        },
        {
          id: "html5-proposal-2020",
          title: "HELP Math with HTML5 Phase I proposal",
          dateLabel: "Archived proposal created in 2020",
          status: "context",
          statusLabel: "Design context",
          summary:
            "A proposal connecting HELP Math modernization to multimedia learning, sheltered instruction, scaffolding, segmentation, vocabulary development, and virtual manipulation.",
          interpretation:
            "Documents a proposed modernization direction. A proposal is not evidence that every proposed feature was implemented or evaluated.",
          sourceLabel: "Local archive: BoulderLearning.PhaseI.HMwithHTML5.pdf",
        },
        {
          id: "scope-2020",
          title: "HELP Math 2.0 scope",
          dateLabel: "Archived scope created in 2020",
          status: "context",
          statusLabel: "Proposed scope",
          summary:
            "A planning document describing a larger learning-platform vision, diagnostic assessment, customizable support, content expansion, and technology updates.",
          interpretation:
            "Shows product ambition, not current website functionality. Proposed features are not described as available unless separately verified.",
          sourceLabel: "Local archive: HELP Math 2.0 Scope.pdf",
        },
        {
          id: "historical-review-records",
          title: "Historical external reviews and awards",
          dateLabel: "Dates and records under review",
          status: "verification",
          statusLabel: "Verification needed",
          summary:
            "Legacy pages refer to federal research review materials, education grants, media coverage, and industry awards.",
          interpretation:
            "These references will be dated and linked to primary records before they are presented as verified achievements on the modern site.",
          sourceLabel: "Legacy website and project archive",
        },
      ],
      reviewPolicy: {
        id: "review-policy",
        eyebrow: "Evidence policy",
        title: "What we record before publishing a claim",
        paragraphs: [
          "Every substantive effectiveness or recognition claim should point to a source that readers can inspect. When a source is unavailable or describes an earlier product version, the limitation travels with the claim.",
        ],
        bullets: [
          "Full citation and stable source location",
          "Publication or award date",
          "Product version and curriculum scope",
          "Study sample, design, measures, and comparison condition where relevant",
          "Finding stated in proportion to the evidence",
          "Known conflicts among archived sources",
        ],
      },
      request: {
        title: "Do you hold a primary report or citation from HELP Math’s history?",
        body:
          "Researchers and former partners may contact the project with bibliographic details or an authorized copy. Do not send student-level records or materials you do not have permission to share.",
        action: { label: "Contact the research archive", href: "/contact?topic=research" },
      },
    },
    resources: {
      metadata: {
        title: "Resources",
        description:
          "Find reviewed HELP Math program, research, and modernization resources, or request an accessible copy from the project team.",
      },
      hero: {
        eyebrow: "Resource library",
        title: "Project materials with their context attached",
        summary:
          "The archive contains useful program and planning documents, but not every file is cleared or accessible for public download. Each item states what it is and how it should—and should not—be interpreted.",
        primaryAction: { label: "Request a resource", href: "/contact?topic=resources" },
        secondaryAction: { label: "View research context", href: "/research" },
      },
      archiveNotice: {
        title: "Accessible publication is in progress",
        body:
          "Source PDFs are being checked for ownership, sensitive content, accurate metadata, readable text order, headings, and image descriptions. Until that review is complete, request access through the project team.",
      },
      filters: {
        ariaLabel: "Filter resources by category",
        all: "All resources",
        program: "Program",
        research: "Research",
        technical: "Modernization",
      },
      items: [
        {
          id: "about-help-math",
          title: "About HELP Math",
          format: "Archived PDF · Program",
          dateLabel: "Created in 2014",
          status: "request",
          statusLabel: "Available by request",
          description:
            "Historical overview of intended learners, instructional design, curriculum descriptions, and the program’s evidence narrative. Counts and claims refer to a past product state.",
          action: { label: "Request this document", href: "/contact?topic=resource-about-help-math" },
        },
        {
          id: "html5-phase-one",
          title: "HELP Math with HTML5: Phase I",
          format: "Archived PDF · Modernization",
          dateLabel: "Created in 2020",
          status: "review",
          statusLabel: "Accessibility review",
          description:
            "Historical proposal for a browser-technology update grounded in multimedia learning and sheltered-instruction concepts. Proposed work should not be read as completed functionality.",
          action: { label: "Ask about this proposal", href: "/contact?topic=resource-html5-proposal" },
        },
        {
          id: "help-math-two-scope",
          title: "HELP Math 2.0 Scope",
          format: "Archived PDF · Program",
          dateLabel: "Created in 2020",
          status: "request",
          statusLabel: "Available by request",
          description:
            "A planning document for expanded content, diagnostics, learner supports, and platform capabilities. It represents a proposed scope rather than this site’s current feature set.",
          action: { label: "Request this document", href: "/contact?topic=resource-help-math-2-scope" },
        },
        {
          id: "modernization-notes",
          title: "Modernization and recovery notes",
          format: "Web resource · Modernization",
          dateLabel: "Living project documentation",
          status: "available",
          statusLabel: "Available on request",
          description:
            "An overview of source preservation, learning-object recovery, validation, accessibility, and staged product planning.",
          action: { label: "Request the current notes", href: "/contact?topic=modernization-notes" },
        },
      ],
      accessibleCopies: {
        title: "Need a different format?",
        body:
          "Tell us which resource you need and the format that would make it usable. We will respond with what is currently available; we cannot guarantee immediate conversion of every archived file.",
        action: { label: "Request an accessible copy", href: "/contact?topic=accessible-resource" },
      },
    },
    support: {
      metadata: {
        title: "Support",
        description:
          "Get current HELP Math project status, answers for returning users, demo troubleshooting, and a safe route to contact the team.",
      },
      hero: {
        eyebrow: "HELP Math support",
        title: "Start with what is available today",
        summary:
          "The modern site offers project information and public JavaScript demos. Former student and educator accounts have not been reactivated, and this site cannot recover old passwords or learning records.",
        primaryAction: { label: "Contact support", href: "/contact?topic=support" },
        secondaryAction: { label: "Check login status", href: "/login" },
      },
      currentStatus: {
        eyebrow: "Current service status",
        title: "What you can use now",
        items: [
          {
            id: "website",
            title: "Public website",
            description:
              "Available in English and Spanish with program, approach, curriculum, research, and support information.",
            detail: "Available",
          },
          {
            id: "demos",
            title: "JavaScript demos",
            description:
              "Selected restored activities run in a modern browser and do not require Flash or a student account.",
            detail: "Public preview",
          },
          {
            id: "accounts",
            title: "Student and educator accounts",
            description:
              "Login, classes, assignments, purchases, and progress reporting are not active on the modern site.",
            detail: "Not available",
          },
        ],
      },
      faqLabel: "Frequently asked questions",
      faqs: [
        {
          id: "old-login",
          question: "Can I use my old HELP Math username and password?",
          answer:
            "No. The modern public site is not connected to the former account system. Do not enter or email an old password. An adult may contact support with an organization name and non-sensitive account context.",
        },
        {
          id: "flash",
          question: "Do I need Flash or a special browser plug-in?",
          answer:
            "No. Public activities on this site are modern JavaScript demonstrations. Original Flash files are preserved privately for restoration evidence and are not required for visitors.",
        },
        {
          id: "full-course",
          question: "Is the full HELP Math course available?",
          answer:
            "Not yet. The current release includes project information and selected demonstrations. Curriculum availability will be described only after source, rights, instructional, and accessibility reviews are complete.",
        },
        {
          id: "student-help",
          question: "I am a student. How should I ask for help?",
          answer:
            "Ask a teacher, parent, guardian, or another trusted adult to contact the project. Never send your password, birthday, student ID, grades, or class records through the form.",
        },
        {
          id: "purchase",
          question: "Can my school purchase HELP Math on this site?",
          answer:
            "No. Online purchasing and public pricing are not part of this launch. An authorized school or organization representative may contact the project to discuss future access or collaboration.",
        },
        {
          id: "demo-problem",
          question: "What should I include in a demo problem report?",
          answer:
            "Share the demo name, page address, device and browser, what you expected, and what happened. A screenshot without personal information can help. Do not include student work or credentials.",
        },
      ],
      contact: {
        title: "Still need help?",
        body:
          "Send a short adult support request. We will use the email address you provide only to respond and manage the request as described in the privacy notice.",
        action: { label: "Open the contact form", href: "/contact?topic=support" },
      },
    },
    login: {
      metadata: {
        title: "Account Access Status",
        description:
          "Learn why former HELP Math accounts cannot be used on the modern website and find the correct support route.",
      },
      hero: {
        eyebrow: "Account access",
        title: "The former HELP Math login is not active here",
        summary:
          "This site is a public modernization preview. It has no student or educator sign-in form and is not connected to the historical account database.",
        primaryAction: { label: "Contact account support", href: "/contact?topic=account-access" },
        secondaryAction: { label: "Use the public demos", href: "/demos" },
      },
      alert: {
        title: "Protect your old credentials",
        body:
          "Do not send a username, password, student ID, grades, or class list. The project team cannot verify or reset a former password through this website.",
      },
      options: {
        eyebrow: "Choose your next step",
        title: "You can still explore or ask for help",
        cards: [
          {
            id: "student",
            title: "I am a student",
            description:
              "Use the public demos without signing in. Ask a parent, guardian, teacher, or another trusted adult to contact us about an old account.",
            action: { label: "Explore demos", href: "/demos" },
          },
          {
            id: "educator",
            title: "I am an educator or school representative",
            description:
              "Contact the project using your work email and organization name. Describe the kind of access or historical account information you need without sharing student data.",
            action: { label: "Request support", href: "/contact?topic=account-access" },
          },
          {
            id: "family",
            title: "I am a parent or guardian",
            description:
              "Tell us the school or organization connected with the former program and how we can help. Leave out passwords and student records.",
            action: { label: "Contact the project", href: "/contact?topic=family-support" },
          },
        ],
      },
      safetyNote:
        "If another website asks for your old HELP Math password, stop and confirm the web address with a trusted adult or your school. The official modern public site does not ask visitors to sign in.",
    },
    contact: {
      metadata: {
        title: "Contact HELP Math",
        description:
          "Send an adult support, resource, research, access, or collaboration request without sharing student records or account credentials.",
      },
      hero: {
        eyebrow: "Contact the project",
        title: "Tell us what you are looking for",
        summary:
          "Use this form for support, historical program questions, resource requests, research information, accessibility feedback, or future collaboration. It is not a student help desk or a secure channel for education records.",
      },
      responseNote: {
        title: "A small restoration team reviews each request",
        body:
          "We review legitimate messages as project capacity allows. Sending the form does not create an account, purchase, service agreement, or guarantee of access or a response by a particular date.",
      },
      form: {
        title: "Send a message",
        intro: "Fields marked as required must be completed before the message can be sent.",
        fields: {
          role: "Your role",
          name: "Name",
          email: "Email address",
          organization: "School or organization",
          topic: "Topic",
          message: "How can we help?",
          privacyConsent:
            "I have read the privacy notice and understand that this form must not include student records, passwords, or other sensitive personal information.",
        },
        placeholders: {
          name: "Your name",
          email: "you@example.org",
          organization: "Optional",
          message:
            "Describe your request without including student names, grades, IDs, passwords, birthdays, or class records.",
        },
        roleOptions: [
          { value: "educator", label: "Educator" },
          { value: "school-representative", label: "School or organization representative" },
          { value: "parent-guardian", label: "Parent or guardian" },
          { value: "researcher", label: "Researcher" },
          { value: "former-partner", label: "Former partner or contributor" },
          { value: "other-adult", label: "Other adult" },
        ],
        topicOptions: [
          { value: "support", label: "Website or demo support" },
          { value: "account-access", label: "Historical account question" },
          { value: "curriculum", label: "Curriculum information" },
          { value: "resources", label: "Resource request" },
          { value: "research", label: "Research or evidence" },
          { value: "accessibility", label: "Accessibility feedback" },
          { value: "collaboration", label: "Future access or collaboration" },
          { value: "project-history", label: "Project history" },
        ],
        submitLabel: "Send message",
        submittingLabel: "Sending…",
        successTitle: "Your message was sent",
        successMessage:
          "Thank you. The HELP Math project team will review your request and reply to the email address you provided when a response is appropriate.",
        errorTitle: "Your message could not be sent",
        errorMessage:
          "Nothing has been submitted. Review the highlighted fields and try again. If the problem continues, wait and try later.",
        validation: {
          required: "Complete this required field.",
          invalidEmail: "Enter a valid email address.",
          consentRequired: "Confirm the privacy statement before sending.",
          messageTooLong: "Keep your message under 2,000 characters.",
        },
      },
      privacyWarning: {
        title: "Do not send student or account secrets",
        body:
          "Do not include grades, assessment answers, disability information, birth dates, student IDs, class lists, usernames, passwords, or other education records. If a request requires protected information, an authorized representative must first arrange an approved secure process.",
      },
      studentNote:
        "Students: please ask a teacher, parent, guardian, or another trusted adult to contact us for you.",
    },
    demos: {
      metadata: {
        title: "JavaScript Demonstrations",
        description:
          "Explore review-stage browser-native restorations of selected HELP Math learning objects without Flash, sign-in, or student-data collection.",
      },
      hero: {
        eyebrow: "Restored demonstrations",
        title: "Small learning objects, rebuilt with care",
        summary:
          "Each demonstration translates a selected legacy interaction into modern JavaScript while preserving the instructional sequence, visible language, timing, and replay behavior supported by the source evidence.",
        primaryAction: { label: "Open the first demo", href: "/demos/conversion-1-2" },
        secondaryAction: { label: "How restoration works", href: "/about#preservation" },
      },
      previewNotice: {
        title: "These are public previews, not the complete HELP Math course",
        body:
          "The demonstrations do not include enrollment, placement, assignments, scoring, or progress records. They collect no answers or student work and should not be used as a diagnostic assessment.",
      },
      listLabel: "Available demonstrations",
      items: [
        {
          id: "conversion-1-2",
          title: "Conversion 1.2",
          summary:
            "A frame-timed reconstruction that coordinates mathematical labels, visual change, and a repeatable explanatory sequence.",
          conceptLabel: "Restoration focus",
          concept: "Timeline, layout, text, and Replay fidelity",
          statusLabel: "Conditional review preview",
          statusDetail: "Available without sign-in",
          action: { label: "Launch Conversion 1.2", href: "/demos/conversion-1-2" },
        },
        {
          id: "conversion-1-4",
          title: "Conversion 1.4",
          summary:
            "A second restored sequence showing how browser-native animation can preserve pacing and explanatory relationships.",
          conceptLabel: "Restoration focus",
          concept: "Responsive vector animation and Replay behavior",
          statusLabel: "Conditional review preview",
          statusDetail: "Available without sign-in",
          action: { label: "Launch Conversion 1.4", href: "/demos/conversion-1-4" },
        },
      ],
      quality: {
        id: "quality",
        eyebrow: "Before a demo is published",
        title: "Source evidence, behavior checks, and visual review",
        paragraphs: [
          "A restoration is reviewed against the original authoring and runtime evidence available to the project. The team records the native stage, timeline, visible states, interactions, and known exceptions instead of treating approximate playback as proof of fidelity.",
        ],
        bullets: [
          "Deterministic key-frame capture and visual comparison",
          "Replay and keyboard behavior checks",
          "Responsive layout, text overflow, and reduced-motion review",
          "Console, asset, and network checks",
          "A written record of any unresolved difference",
        ],
      },
      accessibility: {
        title: "Need help using a demonstration?",
        body:
          "Tell us which demonstration, browser, device, and interaction caused difficulty. Do not include student work or personal records.",
        action: { label: "Send accessibility feedback", href: "/contact?topic=accessibility" },
      },
    },
    demoDetails: {
      "conversion-1-2": {
        metadata: {
          title: "Conversion 1.2 Demonstration",
          description:
            "Run the review-stage Conversion 1.2 HELP Math JavaScript restoration, review usage guidance, and learn the limits of this public preview.",
        },
        eyebrow: "Restored learning object",
        title: "Conversion 1.2",
        summary:
          "This browser-native reconstruction preserves a compact explanatory sequence from the HELP Math archive with frame-based timing, scalable vector graphics, and deterministic Replay behavior.",
        statusLabel: "Conditional review preview",
        statusDetail: "Validation incomplete · No sign-in · No student-data collection",
        instructionsTitle: "Before you begin",
        instructions: [
          "Watch how the labels and visual elements change together across the sequence.",
          "Use Replay to return to the first frame and run the same sequence again.",
          "Keyboard users can move focus to the Replay control and activate it with Enter or Space.",
        ],
        playerLabel: "Conversion 1.2 interactive demonstration",
        loadingLabel: "Loading the demonstration…",
        unavailableTitle: "The demonstration could not load",
        unavailableMessage:
          "Refresh the page once. If it still does not load, report the browser, device, and page address through support.",
        replayLabel: "Replay demonstration",
        restartLabel: "Restart from the beginning",
        pauseLabel: "Pause animation",
        playLabel: "Play animation",
        reducedMotionNote:
          "When reduced motion is enabled, the experience may limit automatic motion while keeping the instructional states available.",
        accessibilityTitle: "Access notes",
        accessibilityNotes: [
          "The activity scales within the page while preserving its original stage proportions.",
          "Visible controls support keyboard focus and activation.",
          "Important text remains part of the modern rendered experience rather than a plug-in surface.",
        ],
        disclaimerTitle: "Demonstration limits",
        disclaimer:
          "This is one restored learning object, not a complete lesson, course, assessment, or current claim of instructional effectiveness. It does not save responses, scores, or progress. Original Flash material remains private restoration evidence and is not served to visitors.",
        backAction: { label: "Back to all demonstrations", href: "/demos" },
        supportAction: { label: "Report a problem", href: "/contact?topic=support" },
      },
      "conversion-1-4": {
        metadata: {
          title: "Conversion 1.4 Demonstration",
          description:
            "Run the Conversion 1.4 HELP Math JavaScript restoration, review usage guidance, and learn the limits of this public preview.",
        },
        eyebrow: "Restored learning object",
        title: "Conversion 1.4",
        summary:
          "This second browser-native example demonstrates the project’s approach to translating instructional motion, labels, and timing into maintainable JavaScript.",
        statusLabel: "Conditional review preview",
        statusDetail: "Validation incomplete · No sign-in · No student-data collection",
        instructionsTitle: "Before you begin",
        instructions: [
          "Follow the sequence from its opening state to the final explanatory state.",
          "Use Replay to restart the activity after the sequence finishes.",
          "Keyboard users can move focus to the Replay control and activate it with Enter or Space.",
        ],
        playerLabel: "Conversion 1.4 interactive demonstration",
        loadingLabel: "Loading the demonstration…",
        unavailableTitle: "The demonstration could not load",
        unavailableMessage:
          "Refresh the page once. If it still does not load, report the browser, device, and page address through support.",
        replayLabel: "Replay demonstration",
        restartLabel: "Restart from the beginning",
        pauseLabel: "Pause animation",
        playLabel: "Play animation",
        reducedMotionNote:
          "When reduced motion is enabled, the experience may limit automatic motion while keeping the instructional states available.",
        accessibilityTitle: "Access notes",
        accessibilityNotes: [
          "The activity maintains its intended proportions at different page sizes.",
          "Visible controls support keyboard focus and activation.",
          "Text and controls are presented by the modern page rather than an obsolete plug-in.",
        ],
        disclaimerTitle: "Demonstration limits",
        disclaimer:
          "This is one restored learning object, not a complete lesson, course, assessment, or current claim of instructional effectiveness. It does not save responses, scores, or progress. Original Flash material remains private restoration evidence and is not served to visitors.",
        backAction: { label: "Back to all demonstrations", href: "/demos" },
        supportAction: { label: "Report a problem", href: "/contact?topic=support" },
      },
    },
    privacy: {
      metadata: {
        title: "Privacy Notice",
        description:
          "Learn what the HELP Math public website collects, why contact information is used, and why visitors must not submit student records.",
      },
      hero: {
        eyebrow: "Privacy notice",
        title: "A public preview designed to collect less",
        summary:
          "The launch website provides information and demonstrations without student accounts or learning-data storage. This notice explains the limited data used to operate the site and respond to adult contact requests.",
      },
      effectiveDateLabel: "Last updated",
      effectiveDate: "July 21, 2026",
      reviewNotice:
        "Owner review required before publication. This draft reflects the planned launch configuration and must be updated if vendors, data flows, or services change.",
      sections: [
        {
          id: "scope",
          title: "1. Scope",
          paragraphs: [
            "This notice applies to the public HELP Math website at helpmath.ai, including informational pages, public demonstrations, and the contact form.",
            "It does not describe a student learning platform, because accounts, classes, assignments, purchases, and student progress storage are not part of this launch.",
          ],
        },
        {
          id: "information",
          title: "2. Information we process",
          paragraphs: [
            "You can browse the public content and use the demonstrations without giving us your name or creating an account.",
          ],
          bullets: [
            "Contact information and message content you choose to submit, including role, name, email address, organization, topic, and message.",
            "Limited technical information processed by our hosting, security, and performance services, such as request time, page, browser or device information, approximate network location, and IP address.",
            "Anti-abuse signals needed to protect the contact form from automated submissions.",
          ],
        },
        {
          id: "use",
          title: "3. How we use information",
          paragraphs: [
            "We use submitted and technical information to operate and secure the website, respond to requests, troubleshoot errors, understand aggregate site performance, and maintain an appropriate record of project correspondence.",
            "We do not use the public contact form to create learner profiles, score student work, or make automated education decisions.",
          ],
        },
        {
          id: "student-data",
          title: "4. Student and sensitive information",
          paragraphs: [
            "Do not submit student names, grades, assessment responses, disability information, birthdays, student IDs, class lists, usernames, passwords, or other education records. The contact form is not an approved secure channel for this information.",
            "Students should ask a teacher, parent, guardian, or another trusted adult to contact the project. If protected information is ever needed for a legitimate request, an authorized organization must first arrange a separate, reviewed process.",
          ],
        },
        {
          id: "sharing",
          title: "5. Service providers and disclosure",
          paragraphs: [
            "We expect to use Vercel to host and monitor the website, Cloudflare Turnstile to reduce form abuse, and Resend to deliver contact messages. These providers may process limited information on our behalf under their own contractual and privacy terms.",
            "We do not sell personal information. We may disclose information when needed to provide support, protect the site or people, comply with law, or complete an organizational transition subject to appropriate safeguards.",
          ],
        },
        {
          id: "retention",
          title: "6. Retention and security",
          paragraphs: [
            "We retain contact messages only as long as reasonably needed to respond, maintain project records, resolve disputes, and meet legal or operational obligations. Hosting and security logs follow the configured retention periods of the relevant services.",
            "We use reasonable administrative and technical safeguards, but no email, form, or internet transmission is guaranteed to be completely secure. This is another reason not to send sensitive records.",
          ],
        },
        {
          id: "choices",
          title: "7. Your choices",
          paragraphs: [
            "You may browse without using the contact form. You may also contact us to ask about access to, correction of, or deletion of information you submitted. We will respond as required by applicable law and may need to verify the request.",
          ],
        },
        {
          id: "international",
          title: "8. International visitors",
          paragraphs: [
            "Our service providers may process information in the United States and other locations. Privacy rights and transfer requirements vary by location; contact us if you have a region-specific question.",
          ],
        },
        {
          id: "changes",
          title: "9. Changes to this notice",
          paragraphs: [
            "We will update the date and revise this notice before introducing materially different data practices, such as accounts, learning analytics, payments, or a new contact system.",
          ],
        },
      ],
      contact: {
        title: "Privacy question or request?",
        body:
          "Use the contact form and choose Accessibility feedback or another relevant topic. Do not include sensitive records in the request.",
        action: { label: "Contact the project", href: "/contact?topic=privacy" },
      },
    },
    terms: {
      metadata: {
        title: "Terms of Use",
        description:
          "Read the terms for using the HELP Math public website, informational content, archived context, and JavaScript demonstrations.",
      },
      hero: {
        eyebrow: "Terms of use",
        title: "Use the public preview thoughtfully",
        summary:
          "These terms cover the informational website and public demonstrations. They do not create a student account, school subscription, purchase, license to archived materials, or guarantee of future access.",
      },
      effectiveDateLabel: "Last updated",
      effectiveDate: "July 21, 2026",
      reviewNotice:
        "Owner and legal review required before publication. Governing entity, jurisdiction, contact address, and any demo-specific license terms must be confirmed for the production version.",
      sections: [
        {
          id: "acceptance",
          title: "1. Acceptance and eligibility",
          paragraphs: [
            "By using this website, you agree to these terms and the privacy notice. If you do not agree, do not use the site.",
            "The contact form is intended for adults. Students should use public content with guidance appropriate to their setting and ask a teacher, parent, guardian, or another trusted adult to make contact requests.",
          ],
        },
        {
          id: "service",
          title: "2. What this site provides",
          paragraphs: [
            "The site provides project information, historical context, support information, and selected JavaScript demonstrations during an active modernization effort.",
            "It does not currently provide enrollment, student or educator accounts, classes, assignments, assessment, progress reporting, payments, or guaranteed access to the historical program.",
          ],
        },
        {
          id: "acceptable-use",
          title: "3. Acceptable use",
          paragraphs: [
            "You may access the public pages and demonstrations for personal evaluation, teaching review, and ordinary educational reference, subject to these terms and any notice shown with a resource.",
          ],
          bullets: [
            "Do not interfere with the site, bypass security or access controls, or overload its services.",
            "Do not use automated systems to scrape, copy, or redistribute the archive or demonstrations at scale without written permission.",
            "Do not upload malicious code, impersonate another person, or use the contact form for spam or unlawful activity.",
            "Do not submit student records, passwords, or other sensitive information.",
          ],
        },
        {
          id: "intellectual-property",
          title: "4. Intellectual property and archival material",
          paragraphs: [
            "The website, project name, restored demonstrations, text, artwork, source materials, and other content may be protected by copyright, trademark, contract, or other rights. Public access does not transfer ownership or grant a right to republish, sell, modify, extract, or create a competing archive.",
            "Historical names and materials may reflect rights held by their respective owners. Contact the project before using content beyond ordinary viewing or classroom evaluation.",
          ],
        },
        {
          id: "educational-use",
          title: "5. Educational context",
          paragraphs: [
            "The demonstrations are examples of restored instructional interactions, not a complete curriculum, diagnostic instrument, individualized intervention, or substitute for an educator’s judgment.",
            "Descriptions of historical research, awards, standards alignment, scope, or features are identified as archival context unless the site expressly states that a current claim has been verified.",
          ],
        },
        {
          id: "availability",
          title: "6. Availability and changes",
          paragraphs: [
            "The project may add, revise, pause, or remove public content and demonstrations as sources, rights, accuracy, security, and accessibility are reviewed. We do not promise that a particular historical resource, account, or feature will become available.",
          ],
        },
        {
          id: "links",
          title: "7. Third-party services and links",
          paragraphs: [
            "The site may rely on or link to third-party services. Their terms and privacy practices apply to their services, and a link does not necessarily mean HELP Math endorses all third-party content.",
          ],
        },
        {
          id: "disclaimer",
          title: "8. Disclaimers and responsibility",
          paragraphs: [
            "To the extent permitted by law, the public preview is provided as available, without promises that it will be uninterrupted, error-free, complete, or suitable for a particular instructional decision. Nothing in these terms limits rights or responsibilities that cannot legally be limited.",
            "You are responsible for using the site in a way that is lawful, age-appropriate, and consistent with your school or organization’s policies.",
          ],
        },
        {
          id: "changes",
          title: "9. Changes to these terms",
          paragraphs: [
            "We may update these terms as the project changes. The updated date will appear above. Materially different services—such as accounts, subscriptions, payments, or student data processing—will require revised terms and privacy information before launch.",
          ],
        },
      ],
      contact: {
        title: "Questions about permitted use?",
        body:
          "Contact the project before copying, publishing, licensing, or distributing HELP Math materials beyond ordinary use of the public website.",
        action: { label: "Ask about use or permissions", href: "/contact?topic=permissions" },
      },
    },
  },
} satisfies SiteContent;
