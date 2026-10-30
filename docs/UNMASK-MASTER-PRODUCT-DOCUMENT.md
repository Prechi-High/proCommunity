# Unmask — Master Product Document

This file is the source of truth for Unmask product direction ("Know before you buy"). It is a full conversion of [`UNMASK-MASTER-PRODUCT-DOCUMENT.docx`](./UNMASK-MASTER-PRODUCT-DOCUMENT.docx) in this folder. Sections, headings, lists, and tables below match that document.

**UNMASK**

# Product & Creator Ecosystem

Master Product Document

*Know before you buy.*

Pre-implementation product decisions, architecture direction, creator model, realtime modes, Spark economy, and operating rules

**STATUS** This document captures the current agreed direction before implementation. It is a product decision document, not yet an implementation plan or technical task list.

## 1. Product Vision

Unmask is a product-intelligence platform designed to help people understand products before and after they buy them. It combines real-user experience, evidence, product intelligence, community knowledge, creator expertise, and AI-assisted investigation.

**CORE IDEA** Unmask is the place people go when they do not just want a product description — they want to know what is actually going on.

The product should feel like a combination of:

- A product intelligence layer that organizes what is known about a product.
- A community where people share real experiences and questions.
- A creator network made up of vetted knowledgeable contributors.
- An evidence desk that turns scattered experiences into useful intelligence.
- An investigation system that can go deeper when a person's specific situation requires it.

## 2. Product Positioning

| Element | Direction |
| --- | --- |
| Name | Unmask |
| Tagline | Know before you buy. |
| Mental model | A special investigator for products |
| Primary promise | Clarity to the core |
| Initial category | Beauty / cosmetics, while architected for broader product categories |
| Long-term behavior | A daily product-intelligence habit with useful, shareable outputs |

## 3. Product Pillars

**Product Intelligence —** Structured product identity, category-specific attributes, claims, specifications, timelines, and intelligence.

**Evidence —** Real-user experiences, external reviews, community evidence, videos, comments, and other grounded sources.

**Community —** People ask questions, share experiences, join conversations, and build collective product knowledge.

**Creators —** Vetted contributors bring expertise, interpretation, communication, and human judgment.

**AI Investigation —** AI gathers, organizes, classifies, verifies, and summarizes evidence, while humans add context and judgment.

**Realtime —** Live, Room, and Ultra create three different ways to consume or produce knowledge.

## 4. Core App Navigation

The primary bottom navigation remains exactly:

| Tab | Purpose |
| --- | --- |
| Today | Daily product intelligence, discoveries, activity, and relevant content. |
| My Products | Products the user follows, tracks, or has interacted with. |
| Unmask | The central product intelligence / investigation entry point. |
| Community | Experiences, questions, conversations, creator activity, and social knowledge. |
| You | Account, profile, personal context, history, preferences, Spark, and settings. |

Other utilities and secondary destinations should be nested rather than added to the bottom navigation.

## 5. The Community Model

Community is not simply a conventional social feed. Its purpose is to create structured product knowledge from everyday experiences.

- Users can share experiences with products.
- Users can ask product-specific questions.
- Users can join conversations rather than being pushed into a comment composer immediately.
- Evidence can be connected to products and categories.
- Community activity can become part of Unmask's structured product intelligence.
- Creators can answer community questions and participate in discussions.

**CONVERSATION RULE** When a user opens a conversation preview, the primary action is “Join conversation.” The preview should not expose a direct comment input/post composer.

## 6. Creator Ecosystem

Unmask Creators are not ordinary users with a decorative badge. They are a distinct class of vetted contributors who help the network produce useful, trustworthy product intelligence.

### 6.1 Creator identity

- Creators should have a proprietary Unmask Creator Mark rather than a generic star icon.
- The identity should be visually distinctive and immediately communicate that this person is a recognized Unmask contributor.
- Creator credibility should be based on contribution quality, reliability, expertise, safety, and behavior — not follower count alone.

### 6.2 Creator levels

| Level / status | Meaning |
| --- | --- |
| Creator Trial | New creator undergoing approximately one month of evaluation. |
| Unmask Creator | Creator who has passed evaluation and can continue contributing. |
| Unmask Expert | Higher-trust creator with demonstrated expertise and strong contribution history. |
| Verified Professional | A creator whose relevant professional credentials have been verified. |

### 6.3 Creator eligibility and verification

- Initial creator cohort should be small — roughly 3–5 creators.
- Creators may come from fields such as dermatology, pharmacy, medical/cosmetic science, or other relevant disciplines.
- Initial creator eligibility should be 18+.
- Identity, relevant education/credentials, safety expectations, conflicts of interest, and code-of-conduct compliance should be reviewed.
- Verification should distinguish education/status from professional credentials; a medical student should not be presented as a dermatologist.
- Creators must stay within appropriate safety boundaries and should not present Unmask content as a diagnosis or substitute for professional care.

## 7. Creator Trial / Probation

**LOCKED DIRECTION** New creators enter approximately 30 days of Creator Trial. Time alone does not guarantee promotion.

During the trial, creators:

- Build their creator profile.
- Perform Unmask activities.
- Answer community questions.
- Participate in Live and Room.
- Participate in Ultra sessions where appropriate.
- Build a visible history of quality, reliability, communication, and safety.

At the end of the trial, Unmask evaluates:

- Reliability
- Helpfulness
- Accuracy
- Communication
- Safety
- Community behavior
- Ultra performance
- Professionalism

Possible outcomes:

- Continue as Creator
- Promote / increase trust level
- Extend probation
- Remove from creator network

## 8. Creator Economics — Initial Stage

**LOCKED DIRECTION** Creators are not paid employees of Unmask in the initial stage.

The purpose of the first stage is to learn whether the creator network creates enough user value and economic activity to support compensation.

- No guaranteed salary or fixed creator payment initially.
- Creators build reputation, contribution history, and eligibility.
- Promotions/campaigns may become an early earning path when opportunities exist.
- Promotions are not guaranteed and should not be represented as guaranteed income.
- Creators can apply or be selected when legitimate promotional opportunities are available.

### 8.1 Economics to measure from day one

- Number of sessions completed
- Session duration
- Users served
- Ultra sessions handled
- Live viewers
- Room participants
- Questions answered
- Gifts received
- Spark generated
- User ratings / helpfulness
- Retention after creator interactions
- AI cost
- Realtime infrastructure cost
- Recording/storage cost

## 9. The Three Realtime Modes

**CORE MODEL** LIVE = discovery. ROOM = discussion. ULTRA = investigation.

| Mode | Primary purpose | Audience | User context | Spark | Recording |
| --- | --- | --- | --- | --- | --- |
| Live | Creator broadcast and discovery | Many viewers | Minimal by default | Normally free | Yes |
| Room | Moderated audio discussion / collective intelligence | Listeners + speakers | Optional | Normally free | Yes |
| Ultra | Structured investigation of a specific situation | One primary requester + audience | Deep / case-specific | Spark required | Yes |

## 10. Live

Live is the TikTok-like creator broadcast layer. It is designed for discovery, education, reactions, demonstrations, product conversations, and spontaneous questions.

- Creators can start a live broadcast.
- Viewers can comment and ask questions.
- Creators can answer general questions directly.
- Creators can switch visual presentation modes when useful.
- A live does not always need to show the creator's face; it can show product visuals, demonstrations, waiting screens, throwbacks, supporting media, or other presentation states.
- Viewers may request or enter Ultra from the live when a situation requires deeper investigation.
- Lives are recorded for later editorial use.

## 11. Room

Room is audio-first and discussion-oriented, closer to a moderated stage or social audio room than a broadcast.

- A creator or moderator hosts the room.
- Most people can listen.
- Selected participants can be brought up to speak.
- The conversation can move naturally between products, questions, and experiences.
- Room should be a collective intelligence environment rather than a private consultation.
- Rooms are recorded and can become future knowledge/content assets.

## 12. Ultra

Ultra is the structured investigation mode. It is not simply a longer Live session or a private call. Its unique value comes from combining a person's specific context with product intelligence, AI research, evidence, and creator judgment.

**CORE DISTINCTION** Ultra is personal intelligence. Live and Room are discovery/community intelligence.

### 12.1 What makes Ultra different

- The requester is the primary case owner.
- Relevant user context can be surfaced: skin type, routine, product timeline, previous experience, questions, and other information relevant to the case.
- AI can research and organize evidence before/during the session.
- The creator can use the structured case context to give a more specific response.
- Other people can watch the investigation.
- The requester can be brought up and can enable their microphone when appropriate.
- The session becomes a reusable knowledge asset after completion.
- Ultra is public by default; Unmask does not initially offer a private 1:1 Ultra mode.

## 13. Live / Room / Ultra Cannibalization Rule

A key product risk is that Live or Room could answer the same question a user would otherwise submit as Ultra. The solution is not to artificially restrict Live or Room.

**LOCKED PRINCIPLE** Live and Room should never be artificially restricted to protect Ultra. They should naturally surface situations where Ultra is the better next step.

The distinction is depth and structure:

| Situation | Best mode |
| --- | --- |
| “What do people think about this product?” | Live / Room / Community |
| “Has anyone experienced irritation with this?” | Live / Room / Evidence / Community |
| “What should someone generally know about this?” | Live / Room / Product Intelligence |
| “Here is my skin type, routine, timeline, symptoms/experience and exact situation — investigate this for me.” | Ultra |
| “I need AI research + evidence + a creator to work through my specific case.” | Ultra |

If a user asks an Ultra-type question in Live or Room, the creator can answer what is reasonably answerable in that setting. If the situation needs deeper personal context, evidence gathering, or structured investigation, Ultra becomes the natural next step.

## 14. Ultra Lifecycle

1. Request — user submits an Ultra request describing what they need investigated.
2. Eligibility — system checks Spark eligibility and required case information.
3. Community contribution — if the requester lacks enough Spark, community contribution can help the case become eligible.
4. Case creation — Unmask creates a structured internal Ultra Case.
5. Queue — the case enters an available / scheduled queue.
6. Creator matching — match based on expertise, problem type, product/category, availability, reputation, language, and relevant compatibility signals.
7. Scheduling or immediate start — an available creator can take the case or the system schedules a session.
8. Notification — requester and relevant participants receive notifications when the case becomes eligible and when a session is scheduled.
9. Room launch — requester + creator + audience enter the Ultra session.
10. Context surface — relevant requester context is available to the creator.
11. Investigation — AI research/evidence and creator reasoning are combined.
12. Resolution — the session produces an answer, conclusion, next steps, or an explicit statement of uncertainty.
13. Recording — session is saved.
14. Knowledge extraction — transcript, evidence, useful segments, and conclusions can feed the Unmask knowledge system.
15. Editorial pipeline — strong segments can be turned into short-form content after human review.

## 15. Creator Availability & Scheduling

The initial creator network may operate with a small number of creators covering availability blocks across roughly 8am–10pm rather than trying to maintain a large always-online workforce.

- Creators declare availability blocks.
- The system uses availability when matching or scheduling Ultra.
- The network should feel increasingly available throughout the day as the creator roster grows.
- Users receive notifications when an Ultra becomes eligible, assigned, or scheduled.
- Scheduled sessions display a clear time to participants.

## 16. Spark Economy

Spark is the product's closed-loop usage currency. Users acquire Spark with money or through defined product mechanisms, then spend Spark on actions that have measurable value or cost.

**ECONOMIC PRINCIPLE** Do not permanently hard-code Spark to a cash value. Spark should remain a controllable product currency so pricing, promotions, and unit economics can evolve.

Initial direction:

- Ultra consumes Spark.
- Normal community posting should generally cost 0 Spark.
- Normal comments / joining conversations should generally cost 0 Spark.
- Watching Live should generally cost 0 Spark.
- Participating in Room should generally cost 0 Spark.
- Gifts can be purchased/converted into Spark denominations.
- Creator cash conversion, if introduced later, should be a separate economic layer rather than treating Spark itself as cash.

### 16.1 Early pricing hypothesis — not locked

A possible early test discussed was a paid monthly access plan around ₦5,000 that provides enough Spark for roughly 3–4 Ultra sessions, with additional top-ups available after exhaustion. This is a hypothesis for experimentation, not a final price.

## 17. Creator Gifts

Unmask may include creator gifts similar to social live platforms. Gifts are an engagement mechanism and a potential future creator-economy signal.

- Users can convert/use Spark for gifts during Live, Room, or other eligible creator experiences.
- Gift denominations can be represented visually (for example 10 / 25 / 50 / 100 / 250 Spark equivalents).
- Gift animations should feel meaningful and expressive rather than like ordinary transaction confirmations.
- Creator cash-out economics are deferred until the broader creator economy has been validated.

## 18. Realtime Sessions as a Content Engine

Live and Ultra recordings should be treated as first-class content assets. The system can turn realtime activity into a potentially continuous source of short-form educational/product content.

- Record Live, Room, and Ultra sessions.
- Transcribe sessions.
- Use AI to identify useful segments, questions, answers, claims, product moments, and strong clips.
- Human editors approve and refine clips before publication.
- Publish selected clips to appropriate Unmask and external channels.
- Feed useful extracted knowledge back into the product intelligence system where appropriate.

## 19. Age & Personal Context

Age should be collected at registration primarily for demographic understanding, safety, and future matching. It should not become an overly visible identity attribute.

- Prefer collecting date of birth privately and deriving age bands.
- Use age as a secondary matching/context signal rather than the primary creator-matching factor.
- Relevant user context should be shown to a creator only when needed for the specific case.
- Creators should not receive unrestricted access to a user's entire history simply because they are handling an Ultra.

## 20. Safety, Trust & Professional Boundaries

- Creator credentials must be represented accurately.
- Medical or professional claims should not exceed the creator's actual qualification.
- Creators should disclose relevant conflicts of interest.
- Unmask should maintain a clear boundary between product intelligence and medical diagnosis.
- The system should preserve uncertainty rather than fabricate certainty when evidence is insufficient.
- Relevant user context should be minimized to what is necessary for the case.
- Creator behavior and safety should be part of the trial and ongoing evaluation system.

## 21. Creator Matching

Matching should prioritize usefulness rather than popularity.

1. Relevant expertise
2. Problem / question type
3. Product category
4. Availability
5. Creator reputation and reliability
6. Language
7. Relevant age compatibility where useful

## 22. Evidence & Product Intelligence

The realtime creator ecosystem sits on top of Unmask's broader product intelligence system. The product should not become merely a live-chat platform.

- External evidence and community evidence can appear together in Evidence.
- Evidence is filtered by meaningful tags/categories.
- A single piece of evidence may belong to multiple semantic categories.
- The active category should highlight the exact relevant span when possible.
- Sentiment/stance should support positive, negative, and mixed interpretations.
- YouTube and other external sources should be semantically relevant to the selected product, not loosely matched by generic keywords.
- AI should understand product-linked language and meaning rather than rely only on hard-coded keyword lists.

### 22.1 Research performance direction

- Parallelize independent research/fetch/classification tasks.
- Use shared model infrastructure where appropriate while dividing work into specialized batches.
- Process evidence incrementally instead of waiting for the entire research run to finish.
- Measure accuracy, processing time, API usage, infrastructure cost, and evidence yield before scaling.

## 23. Product Understanding UX

The product interface should communicate clarity and evidence rather than looking like a generic skincare or social application.

- White background.
- High-end, highly scannable layout.
- Overview first; dense information should be layered rather than dumped on screen.
- Company claims first when available; otherwise surface categorized real-user evidence.
- Category scores out of 100 where enough evidence exists.
- Optional personalization based on relevant context such as skin type, while acknowledging sparse context in early data.
- Product-specific questions should be distinct from generic Community questions.
- If an answer is not available from current evidence, users can be prompted to ask/share it with Community.
- Follow-product functionality.
- External video resources appear with useful tags rather than a generic “public videos” count.

### 23.1 Product tabs

| Tab | Purpose |
| --- | --- |
| Overview | Fast product understanding and most important findings. |
| Evidence | External + community evidence, filtered by tags/categories. |
| Claims | Manufacturer/brand claims and how evidence relates to them. |
| Timelines | Product use/result timelines and chronological context. |
| Questions | Product-specific unanswered/answered questions. |

## 24. Unmask Brand / Design System

| Element | Direction |
| --- | --- |
| Primary wine | #2A0E16 |
| Raised wine | #3A1622 |
| Bone | #F3EBE2 |
| Highlighter | #F2D25B |
| Sage | #9FD0AB |
| Honey | #E8B95A |
| Coral | #EE8C7C |
| Redaction | #0B0306 |
| Fonts | Boska + General Sans |
| Motifs | Redaction peel + highlighter |
| App icon cue | Camera / focus / reveal concept |

The visual language should make Unmask feel like an evidence desk / reveal system rather than a generic review site.

## 25. High-Level Technical Direction

Implementation should extend the existing Unmask application rather than create a disconnected new product.

| Layer | Direction |
| --- | --- |
| Frontend | Existing Next.js / React application and established navigation. |
| Database | Supabase / PostgreSQL. |
| Realtime | A realtime infrastructure layer such as LiveKit is a strong candidate for Live, Room, and Ultra. |
| Recording | Realtime egress and/or a dedicated video storage/delivery layer such as Cloudflare Stream can be evaluated. |
| AI orchestration | Existing research worker / provider-routing architecture, extended for realtime cases and post-session processing. |
| Caching | Redis / existing caching strategy where appropriate. |
| Deployment | Existing Vercel project. |
| Content processing | Transcription + AI segmentation + human editorial approval. |

**IMPLEMENTATION RULE** Architecture decisions should preserve the current production app and existing research/data model wherever possible. New realtime capabilities should be added as a coherent layer, not by replacing the current product intelligence foundation.

## 26. Core Conceptual Entities

| Entity | Purpose |
| --- | --- |
| User | Account, private demographic/context data, preferences, history. |
| Product | Canonical product identity and product intelligence. |
| Experience | User's structured product experience. |
| Question | Product/community question. |
| Evidence | External or community-backed product evidence. |
| Creator | Vetted contributor identity and reputation. |
| Creator Trial | Evaluation period and scorecard. |
| Live Session | Broadcast session. |
| Room Session | Moderated audio discussion. |
| Ultra Case | Structured investigation for a primary requester. |
| Ultra Session | Realtime execution of an Ultra case. |
| Spark Ledger | Auditable record of Spark grants, purchases, spends, gifts, and adjustments. |
| Gift | Creator-support / engagement transaction. |
| Recording | Captured Live / Room / Ultra media. |
| Transcript / Segment | Machine-processed and human-approved knowledge/content units. |
| Creator Opportunity | Future promotion/campaign opportunity. |

## 27. Notifications

- Ultra becomes eligible.
- Ultra receives enough community contribution to proceed.
- Ultra is assigned to a creator.
- Ultra is scheduled.
- Session is approaching.
- Creator starts Live.
- Relevant community/creator activity occurs.
- A useful follow-up or extracted result is ready.

## 28. Deliberately Not Yet Locked

The following should remain experiments or implementation decisions rather than being treated as final product truth:

- Exact Spark cost per Ultra.
- Exact monthly Spark subscription price.
- Exact Spark allocation and expiry rules.
- Exact gift denominations and creator conversion model.
- Exact creator promotion economics.
- Exact number of creators beyond the initial small cohort.
- Exact realtime vendor choice.
- Exact recording/storage provider.
- Exact creator compensation model after the initial test.
- Exact matching algorithm weights.
- Exact eligibility threshold for community-assisted Ultra funding.

## 29. Product Principles to Protect During Implementation

1. Do not turn Unmask into a generic social network.
2. Do not turn creators into generic influencers.
3. Do not hide evidence behind entertainment.
4. Do not artificially restrict Live or Room just to force Ultra purchases.
5. Do not make Ultra valuable merely because it is longer; make it valuable because it is structured and context-aware.
6. Do not expose unnecessary private user context to creators.
7. Do not present credentials more strongly than they actually are.
8. Do not fabricate certainty when evidence is weak.
9. Do not lock Spark to a permanent cash exchange rate too early.
10. Do not pay creators before the economics are understood.
11. Do not promise creator promotions as guaranteed income.
12. Do not let the realtime layer replace the underlying product-intelligence database.
13. Do not implement phases 4–5 of the older roadmap prematurely.

## 30. Implementation Sequence — After Product Approval

This is the recommended sequence once this document is approved. It intentionally stops short of writing code.

1. Freeze this product document as the source of truth.
2. Audit the current production app against the document and identify conflicts/legacy surfaces.
3. Design the creator identity, creator profile, verification, trial, and reputation model.
4. Design the Live / Room / Ultra information architecture and user flows.
5. Design the Ultra Case lifecycle, queue, matching, scheduling, notifications, and Spark accounting.
6. Design the realtime infrastructure and recording architecture.
7. Design the session transcript → AI extraction → human editorial workflow.
8. Design the conceptual database changes and event/ledger model.
9. Implement creator trial and creator identity.
10. Implement Live.
11. Implement Room.
12. Implement Ultra lifecycle and realtime room.
13. Implement Spark/gifts behind measurable accounting.
14. Implement recording/transcription/content extraction.
15. Run controlled economic and quality tests before introducing creator compensation.

## 31. Initial Success Metrics

| Area | Metrics |
| --- | --- |
| Creator quality | Accuracy, helpfulness, reliability, safety, retention. |
| Live | Viewer retention, questions/session, useful interactions, conversion to deeper product actions. |
| Room | Participation, speaker turns, completion, useful knowledge generated. |
| Ultra | Request-to-session rate, completion rate, resolution quality, requester satisfaction. |
| Economy | Spark purchased, Spark spent, Spark velocity, gift activity, cost per session. |
| Infrastructure | Realtime cost, AI cost, recording cost, latency, failure rate. |
| Content | Clips generated, clips approved, clips published, engagement. |
| Product intelligence | Evidence relevance, source quality, coverage, update frequency. |

## 32. Final Product Model

**UNMASK** A product-intelligence network where people discover, discuss, investigate, and understand products.

The ecosystem can be summarized as:

| Layer | Role |
| --- | --- |
| Product Intelligence | The knowledge foundation. |
| Community | Everyday human experience and collective questions. |
| Creators | Trusted human interpretation and contribution. |
| Live | Discovery. |
| Room | Discussion. |
| Ultra | Structured investigation. |
| AI | Research, organization, classification, summarization, and extraction. |
| Spark | Controlled usage/economic layer. |
| Recordings | Reusable knowledge and content engine. |

**LIVE → discovery    |    ROOM → discussion    |    ULTRA → investigation**

**Unmask — Know before you buy.**
