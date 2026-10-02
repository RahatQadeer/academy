# **Private Attaché Ecosystem** 

## **Software Requirements Specification — Version 2 (Consolidated)** 

Table of Contents 

### **1. Brand Hierarchy and Terminology** 

1.1 Private Attaché is the master brand and owns the application shell. The upper-left branding of the professional application, the authentication screens, and the Partner Center is Private Attaché, not Whitby. 

1.2 Whitby is the intelligent coordination layer and assistant that operates inside the Private Attaché application. Whitby appears throughout the product in named actions such as Ask Whitby, Build with Whitby, and Draft with Whitby, and in proactive alerts and recommendations, rather than functioning as the name of the application itself. 

1.3 The product is referred to as Whitby or Whitby™ throughout the interface. The term WhitbyOS is not used anywhere in the product or its documentation. 

1.4 The Client Portal is branded per company rather than as a Whitby product. The portal’s branding is simplified to “[Company Name] Client Portal,” for example “Acme Client Portal,” so the client sees the professional or company relationship first. A subtle “Powered by Whitby” mark may be considered later but is not required for this version. 

1.5 The Partner Center is branded as Private Attaché / Partner Center, not as Whitby. It is positioned first as a partnership and introduction program, with compensation terms presented as secondary. 

1.6 The trademark symbol is used selectively, on primary logo and wordmark treatments and the first prominent brand reference on a page, rather than on every label or every screen. Where the trademark symbol is not used, the accent mark is retained, for example “Private Attaché.” 

1.7 The product formerly called “Institute” is Private Attaché Academy, or Academy. It is not referred to as WinstonOS Institute or any other legacy name. 

1.8 The overall brand hierarchy is: Private Attaché is the master brand; Whitby is the intelligent coordination platform and assistant within it; the Client Portal is the company-branded client experience; the Partner Center is the Private Attaché partner experience. 

1.9 The core operating hierarchy across the professional platform is Client → Request → Workplan → Workstreams → Tasks and Work Products → Completion. The Request and the Workplan together form the operating spine of the product; every supporting object exists to strengthen this flow rather than to compete with it or fragment it into a separate miniapplication. 

1.10 A Client is the served relationship or account container. A Client may represent an individual, a family or household, a company, or an organization. A Client record must never duplicate the underlying Contact or Company record it is built from. 

1.11 A Contact is a reusable person record. Labels such as Primary Member, Additional Member, Authorized User, Dependent, Primary Contact, Billing Contact, and Decision-Maker are relationship roles applied to a Contact, not separate record types. One person may hold different roles across different Clients, Companies, and Requests without ever creating a duplicate Contact record. 

1.12 A Company is a reusable organization or business record. A Company is linked to Contacts, Clients, Requests, and Provider activity, and other records. A single Company may simultaneously be the served Client and also hold a Provider role, without duplication. 

1.13 A Provider is a role or status applied to an existing Contact, Company, or both. The system never creates a duplicate Provider entity when an underlying Contact or Company record already exists. 

1.14 Every object in the system carries one of three visibility levels: Internal, Client Visible, or Restricted. Client visibility alone is not sufficient for a client-side user to see an object; the user’s specific Client, Request, and conversation-level permissions must also allow access. 

1.15 Whitby may read, organize, extract, suggest, draft, and create reversible internal work without human approval. Whitby must not take material external actions, make commitments, spend money, change permissions, disclose sensitive information, or exercise professional judgment without human review and approval. Every Whitby-derived piece of information must preserve a link back to its source and must remain correctable or dismissible by the professional. 

1.16 Requests are completed or closed rather than casually deleted. Closing a Request preserves its Timeline, Work Summary, decisions, communications, documents, evidence, and any unresolved items. Authorized users may reopen a closed Request. 

1.17 The Professional Center must be built ready to coexist with Private Attaché Academy through a shared identity and entitlement system and a product switcher or equivalent mechanism, without cluttering the professional workspace with Academy-specific navigation. 

1.18 The system is built future-ready without being overbuilt: data relationships, event hooks, and permissions must be preserved to support future provider sourcing automation, outreach automation, service-level expectations, Academy integration, enterprise controls, and broader integrations, without requiring every one of these future features to be built into this version. 

### **2. Global Navigation and User Experience Principles** 

2.1 The Client area, the Partner area, and the Professional area all use a consistent left-side navigation pattern, with sub-navigation and additional views available within each primary navigation section rather than as separate top-level items. 

2.2 The left navigation is expanded by default and is collapsible by the user. The user’s expanded or collapsed preference is remembered across sessions where practical. When collapsed, navigation items are represented by icons with tooltips. 

2.3 Deeper work stays contextual within the relevant module rather than being pushed into additional top-level navigation items; the navigation rail is kept useful and lean. 

2.4 A persistent Quick Add control is available near the top of the navigation rail at all times, offering Request, Task, Communication, Note, Document, and Form as quick-create options. Quick Add prefills the current Client, Contact, Provider, or Request context when launched from within one. Contextual pages may separately expose their own add actions, such as Add Provider, Schedule Event, Draft Message, or Add Decision, distinct from the global Quick Add. 

2.5 An “Add to Request” action is kept visibly distinct from Quick Add. Add to Request links an existing Message, Communication, Form submission, Document, Provider, Calendar event, Insight or research finding, or an existing Task or Note to a specific Request, while preserving the original source record. Whitby may propose downstream effects of this action, such as creating a Task, a Worksheet row, a decision, a provider update, a date, or a Workplan change, but the system must never silently rewrite the Request or Workplan from consequential external information without human review. 

2.6 Global search and a small number of useful saved views and filters are available from the navigation. Most list screens display roughly five to seven useful columns by default, while still supporting optional additional columns without forcing every field onto the screen at once. 

### **3. Authentication** 

#### **3.1 Professional Login and Sign-Up** 

3.1.1 The upper-left branding on the professional login and sign-up screens is Private Attaché, not Whitby, consistent with Section 1. 

3.1.2 The professional authentication layout, and the Google, Microsoft, and email sign-in options, are retained from the current design. 

3.1.3 The field labeled “Work Email” is renamed to “Email Address.” 

3.1.4 The left side of the authentication screen displays a product or workflow example rather than a customer testimonial. 

#### **3.2 Client Portal Authentication** 

3.2.1 Client invitation and login screens clearly display who invited the client, which company the invitation is from, and what the invitation relates to. 

3.2.2 An “Already have an account? Sign in” link is present for returning clients. 

3.2.3 The Client Portal authentication experience is branded as “[Company Name] Client Portal” rather than as Whitby, consistent with Section 1.4. 

#### **3.3 Partner Center Authentication** 

3.3.1 Partner Center authentication screens are branded as Private Attaché / Partner Center, not as Whitby. 

3.3.2 The Partner Center is positioned as a partnership and introduction program first, with compensation terms presented as secondary rather than as the primary framing. 

3.3.3 Referral and commission terms are presented as configurable per partner rather than as universally fixed figures. 

#### **3.4 Academy Authentication** 

3.4.1 There is no public or self-service teacher or instructor sign-up anywhere in the Academy. 

3.4.2 Every person entering the Academy defaults to the Learner role upon account creation or first entry. 

3.4.3 Instructor and Academy Admin or Content Admin permissions are assigned separately by a Private Attaché administrator; they are never granted through a self-service sign-up flow. 

3.4.4 If the person already holds a Private Attaché or Whitby identity from another product, the system reuses that identity’s existing information rather than asking them to re-enter it. 

### **4. Onboarding** 

#### **4.1 Guiding Principle** 

4.1.1 Onboarding is kept to approximately three to five screens maximum for each user type. 

4.1.2 The purpose of onboarding is limited to establishing basic identity and account information, workspace or client context, initial access and permissions, and a small amount of personalization. 

4.1.3 Anything deeper than this is deferred to the relevant Profile, Settings, People & Access, or Academy area rather than extending onboarding into a fifteen-to-twenty-minute intake process. 

4.1.4 The governing principle across every onboarding flow is: identity plus context plus access plus light personalization, leading the person into the product quickly. Deeper profiles, preferences, integrations, permissions, learning choices, and configuration happen naturally inside the product afterward. 

#### **4.2 Professional Onboarding — Step 1 of 4: Workspace Basics** 

4.2.1 The professional enters the workspace or company name. 

4.2.2 The professional enters a primary contact. 

4.2.3 The professional enters a workspace URL. 

4.2.4 The professional enters a team size. 

4.2.5 The professional selects a time zone. 

4.2.6 The professional may optionally upload a logo, and this step may be skipped entirely. 

#### **4.3 Professional Onboarding — Step 2 of 4: What Kind of Work Do You Coordinate?** 

4.3.1 The professional may select one or more work types from a multi-select list. 

4.3.2 This step is entirely optional. 

4.3.3 The selections made here are used to personalize Playbooks, examples, recommendations, and Whitby’s guidance for this workspace. 

4.3.4 The selections made here must never be used to split Whitby into separate products or separate environments. 

4.3.5 The list of work types includes an option for “Something Else.” 

#### **4.4 Professional Onboarding — Step 3 of 4: Invite Your Team** 

4.4.1 The professional may enter an invitee’s email address. 

4.4.2 The professional may select an initial role for the invitee. 

4.4.3 This entire step is optional and may be skipped. 

4.4.4 Detailed role and permission configuration is deferred to the People & Access area rather than being forced during onboarding. 

#### **4.5 Professional Onboarding — Step 4 of 4: Ready to Go** 

4.5.1 The system displays a summary confirming that the workspace was created, which team members were invited, and which initial preferences were captured. 

4.5.2 The system may suggest connecting Gmail, Outlook, Google Calendar, and Outlook Calendar at this step, but connecting these integrations remains optional and must not block continued access to the product. 

4.5.3 The screen presents a call to action reading “Get Started with Whitby.” 

#### **4.6 Client Onboarding — Step 1 of 5: About You** 

4.6.1 The client enters their full name. 

4.6.2 The client may enter a preferred name. 

4.6.3 The client may select a salutation or title where appropriate, such as Dr., Mr., Mrs., Ms., Sir, or Dame. 

4.6.4 The client enters an email address. 

4.6.5 The client enters a phone number. 

4.6.6 The client selects a time zone. 

4.6.7 The client may indicate a company or household association where applicable. 

4.6.8 The profile captured at this step is intentionally minimal; additional details can be added later. 

#### **4.7 Client Onboarding — Step 2 of 5: Communication and Preferences** 

4.7.1 The client selects a preferred communication channel. 

4.7.2 The client sets notification preferences. 

4.7.3 The client sets update preferences. 

4.7.4 The client may indicate language or accessibility considerations where relevant. 

4.7.5 Deeper preferences are deferred to the client’s profile for later configuration. 

#### **4.8 Client Onboarding — Step 3 of 5: People and Access** 

4.8.1 The client may request that additional people be associated with their account, for example an Additional Member, an Authorized User, an Assistant, a family or household contact, a Billing Contact, or another relevant contact. 

4.8.2 For each requested person, the client provides a name, an email address, a relationship or role, and the requested access or a reason for the access. 

4.8.3 The client must not be able to directly grant portal access to anyone. The client can only submit a request for the professional to review. 

#### **4.9 Client Onboarding — Step 4 of 5: Professional Approval Workflow** 

4.9.1 The professional receives the client’s access request and may approve it, change the requested role or permissions before approving, or decline it. 

4.9.2 Whitby sends the invitation to the requested person only after the professional has approved the request. 

4.9.3 The end-to-end flow is: the client requests a person, the professional reviews the request, the professional approves, edits, or declines the request, Whitby sends the invitation upon approval, the invited user activates their account, and the approved permissions then apply. 

4.9.4 Every access and permission change resulting from this flow is recorded in the account’s access history. 

#### **4.10 Client Onboarding — Step 5 of 5: Welcome** 

4.10.1 The system gives the client a short explanation of what they can do in the portal: view Requests and progress, see Updates, complete Tasks and Action Needed items, message the professional or team, upload and view Documents, and use the Calendar where applicable. 

4.10.2 The screen presents a call to action reading “Get Started in Your Client Portal.” 

4.10.3 The portal is branded as “[Company Name] Client Portal” throughout onboarding, per Section 1.4. 

#### **4.11 Academy Onboarding — Step 1 of 3: Account Basics** 

4.11.1 The system reuses any information already available from an existing Private Attaché or Whitby identity rather than asking the learner to re-enter it. 

4.11.2 If the learner has no existing identity, they provide the minimum information needed to create one. 

#### **4.12 Academy Onboarding — Step 2 of 3: What Are You Interested In?** 

4.12.1 The learner may select one or more interests from a multi-select list, including professional certification and coordination, specialty capability, building or growing a professional practice, Whitby and intelligent coordination, short courses or continuing learning, and just exploring. 

4.12.2 This step is interest-based and must never force the learner down a single, fixed program path. 

4.12.3 The selections made here are used only for recommendations and personalization within the Academy, specifically the “Recommended for You” experience, and never determine the Academy’s underlying structure or the learner’s access. 

#### **4.13 Academy Onboarding — Step 3 of 3: Your Academy** 

4.13.1 The learner is taken into one unified Academy environment covering the full catalog, rather than being routed into a separate environment per program. 

4.13.2 Access to any given program is governed by purchase, entitlement, prerequisite, or administrative assignment, never by what the learner selected during onboarding. 

4.13.3 Purchased programs automatically appear in the learner’s My Learning area. 

4.13.4 The Intelligent Coordination program appears wherever the learner is entitled to it. 

4.13.5 Specialty Endorsement programs respect their Certified Private Attaché prerequisite. 

4.13.6 Free programs may be made broadly available without a purchase step. 

4.13.7 Future paid programs can be added to the catalog without requiring a redesign of onboarding. 

4.13.8 The screen presents a call to action reading “Get Started in Private Attaché Academy.” 

#### **4.14 Partner Onboarding** 

4.14.1 A short onboarding checklist is presented to a partner after their application has been approved, rather than dropping them directly into the Partner Center with no guidance. 

4.14.2 The onboarding checklist captures or confirms: company or legal name, website, primary contact, partner or business type, company locations and addresses, markets and geographies 

served, audience served, relevant categories, subcategories, and capabilities drawn from the shared taxonomy described in Section 10, additional team members and contacts, agreement completion, confirmed partner programs and terms, issued referral links and access codes, Tax Profile completion, and payment or payout setup. 

4.14.3 The onboarding checklist reuses the shared, configurable Category and Subcategory taxonomy for describing the partner’s relevant categories and capabilities, rather than introducing a separate, hard-coded taxonomy specific to partners. 

### **5. Professional Center** 

#### **5.1 Main Navigation** 

5.1.1 The main navigation contains: Home, Clients, Contacts, Providers, Requests, Playbooks, Tasks, Calendar, Messages, Updates, Forms, Documents, Knowledge, Insights, Reports, Integrations, and Settings. 

5.1.2 Companies are not given their own top-level navigation slot. Companies live inside the broader Contacts area, described in Section 5.4, alongside People. 

5.1.3 Tasks and Calendar are both kept as global, cross-Request views in addition to appearing nested inside an individual Request, so the professional can work from either level. 

#### **5.2 Home** 

5.2.1 The Home page answers what needs attention, what changed, and what should happen next. 

5.2.2 Home surfaces Requests at risk, items waiting on the professional, overdue and upcoming Tasks, decisions and approvals pending, Forms and Documents needing action, new Messages, relevant Calendar items, missing information, and Whitby’s recommendations. 

5.2.3 Home combines the Whitby prompt experience with the operational briefing on a single screen, rather than presenting two separate and competing Home concepts. 

5.2.4 Home subdivides into Today’s Briefing, Action Needed, and Recent Activity. 

#### **5.3 Clients** 

5.3.1 The Clients area covers All Clients, Active, Recent, and Add Client. 

5.3.2 Opening a Client shows the people involved, the Client’s Requests, portal access, preferences, billing context, communications, documents, Timeline, and the recommended next action. 

5.3.3 A Client detail view brings together an Overview section containing profile, Client type, status, owner or team, current summary, next action, and recent activity; a Preferences and Handling section containing communication preferences, privacy and sensitivity notes, handling instructions, and important dates or context; a People and Authority section containing Primary and Additional Members, Authorized Users, Dependents, Primary and Billing Contacts, decision-makers, and representatives; a Work section containing current and 

previous Requests, Tasks, Forms, Documents, Messages, Updates, and Calendar; an Account section containing Client Portal access, billing and engagement context where applicable, and the assigned team; and a History section containing the Timeline, Notes, Communications, and other meaningful prior activity. 

5.3.4 The professional defines the maximum capabilities available to a given Client’s portal account; this ceiling governs everything the client side can subsequently do. 

#### **5.4 Contacts** 

5.4.1 The Contacts area is the reusable relationship directory and covers All Contacts, People, Companies, Recent, and Add Contact or Company. 

5.4.2 Companies live inside this broader Contacts area rather than occupying a separate toplevel navigation slot. 

5.4.3 A Contact detail view brings together contact details, company or role, Client relationship labels, authority, communication preferences, linked Clients, Companies, and Requests, Tasks, Messages and Communications, Notes, Documents, the recommended next action, and the Timeline. 

5.4.4 A Company detail view brings together profile and classification, locations and markets, contacts, services and specialties, Provider status and evidence where applicable, linked Clients and Requests, Tasks, Documents, Messages and Communications, Notes, the recommended next action, and the Timeline. 

5.4.5 One person’s Contact record may hold multiple relationship roles simultaneously without duplication. 

5.4.6 A Company record may simultaneously serve as a Client and hold a Provider role, without duplication. 

#### **5.5 Relationship Roles on a Contact** 

5.5.1 A Primary Member is the main person in an individual or family Client relationship, with portal access and the ability to manage their own Requests. A Primary Member may manage people only within the capabilities the professional has enabled for that Client account. 

5.5.2 An Additional Member is another actual Member within the Client relationship, such as a spouse, partner, adult child, or parent, with portal access and the ability to manage their own permitted Requests. Membership in the same Client account does not automatically create reciprocal visibility between Members. 

5.5.3 An Authorized User is a person, such as an assistant, chief of staff, or household manager, who acts for one or more Members within defined permissions, with portal access but no personal Member-level entitlement of their own. An Authorized User is not automatically considered a Member. 

5.5.4 A Dependent, also called a Related Person, is a Client-related Contact who does not require portal access by default, such as a young child or dependent household member. A Dependent can later become an Additional Member if direct portal access becomes necessary. 

5.5.5 A Primary Contact is the main human relationship contact for a Company or Organization Client. This concept is required for company-type Clients and must not force individual or household-style language onto a business relationship. 

5.5.6 A Billing Contact is a Contact responsible for invoice and billing communication and may hold billing visibility without receiving broad Request access. 

5.5.7 A Decision-Maker or Approver is a person authorized to decide or approve defined matters. The scope and any consequential thresholds of this authority should be explicit wherever they are consequential. 

5.5.8 An Authorized Representative is a representative with defined authority; that authority must be recorded explicitly and never assumed from the underlying relationship alone. 

#### **5.6 Access Rules** 

5.6.1 The professional defines the maximum capabilities available to a Client account; this is the account ceiling referenced in Section 5.3.4. 

5.6.2 A Request’s access level is one of: Private to Requestor, Selected People, or Client Account / All Permitted Members, and Restricted controls may further narrow access on top of this setting. 

5.6.3 Conversation access can be narrower than the Request access level. Adding a person to a conversation does not automatically grant them full Request access. 

5.6.4 The system tracks invitations, access changes, participant changes, and any material restricted-access grants or revocations for audit purposes. 

### **6. Requests and Workplans** 

#### **6.1 Request Overview** 

6.1.1 A Request represents one defined outcome the professional is accountable for coordinating. 

6.1.2 The Overview area of a Request contains the desired outcome, the definition of done, the Client, the owner, the status, the priority, the start and target dates, what the Request is waiting on, the next action, and a current summary. Selected fields from this area may be made clientvisible. 

#### **6.2 Scope, Authority, and Timing** 

6.2.1 The Scope and Constraints area contains scope, exclusions, assumptions, budget and cost context, location, timing, and requirements or quality constraints. Whitby may flag ambiguity or missing information here, but the professional confirms it. 

6.2.2 The Authority and Approvals area contains the decision-maker, the approver, the payer where relevant, delegated authority, thresholds, and approval status. The system must never proceed through a consequential threshold without the required authority being in place. 

6.2.3 The Timing area contains the final deadline, decision dates, provider dates, lead times, escalation dates, and key calendar events. These dates feed the attention system, Tasks, and Calendar context without flooding the Calendar with every minor date. 

#### **6.3 People and Participation on a Request** 

6.3.1 A Request’s participants include the professional’s team members plus Request-linked Client Contacts, Companies, Providers, decision-makers, approvers, Authorized Representatives, and other relevant participants. 

6.3.2 An individual Workstream, described in Section 6.6, can narrow this overall participant list down to the people actually involved in that specific component. 

6.3.3 Linking a person to a Workplan or a Workstream does not automatically expand their portal access, their Request access, or their conversation access; each of these permissions remains independently controlled. 

6.3.4 The system reuses canonical Contact, Company, and Provider records for every participant; it never creates a duplicate record to represent participation. 

#### **6.4 The Workplan** 

6.4.1 The Workplan is the overall, fully editable plan for completing the Request, and it must remain editable after creation and after activation. The professional can add, remove, reorder, and revise both the Workstreams and the work inside them at any time. 

6.4.2 The Workplan has a plan name, usually derived from the Request but editable independently. 

6.4.3 The Workplan has a desired outcome, editable and refinable with Whitby, which should remain aligned to the Request’s own desired outcome. 

6.4.4 The Workplan has a definition of done, which the professional edits and confirms, and which supports closeout and the final Work Summary. 

6.4.5 The Workplan has an owner, the professional accountable for the Workplan, assignable and reassignable subject to team permissions. 

6.4.6 The Workplan has a status of Draft, Active, Paused, or Complete, or an equivalent controlled value; the system must never silently close active work. 

6.4.7 The Workplan has overall start and target dates, editable by the professional, which can feed Calendar context where intentionally represented. 

6.4.8 The Workplan has a current next action, the single most important immediate step across the entire plan, editable by the professional and suggestible by Whitby; this field is useful for the Home and attention views. 

6.4.9 The Workplan contains its prioritized, editable Workstreams, described fully in Section 6.6; adding, editing, renaming, dragging to reorder, prioritizing, assigning, pausing, completing, and removing Workstreams is the primary way the professional shapes the plan. 

6.4.10 The Workplan contains Considerations, Whitby’s insights across the whole plan, described in Section 6.8, which the professional can review, dismiss, resolve, or convert into an appropriate action; the system never auto-creates work from an insight without the professional’s action. 

6.4.11 The Workplan preserves a current version and prior material versions; the professional can save a version, view history, and restore or copy from history where appropriate; material changes always preserve their history and reason. 

6.4.12 Where the workspace process requires it, the Workplan supports a review and approval state, with the professional submitting, approving, or revising the plan; human approval always remains authoritative. 

6.4.13 A Workplan is started through one of four build options: Build with Whitby, Use a Playbook, Import an Existing Plan, or Start Blank. Whichever path is chosen, the professional then edits the resulting plan normally. A Playbook used as a starting point is a starting structure, not a locked, live template that continues to control the resulting Workplan. 

#### **6.5 Workplan Creation Paths in Detail** 

6.5.1 Build with Whitby: Whitby drafts a proposed Workplan, including editable Workstreams, supporting items, and Considerations, for the professional’s review. 

6.5.2 Use a Playbook: the professional applies a reusable Playbook and adapts it to the current Client and Request without altering the original Playbook record. 

6.5.3 Import Existing Plan: the professional imports a document, spreadsheet, or checklist, and the system proposes a structured mapping of that content into the Workplan format. 

6.5.4 Start Blank: the professional builds the plan manually, with selected Whitby assistance available throughout. 

#### **6.6 Workstreams** 

6.6.1 A Workstream is a major, editable component of the Workplan; it is not a separate product or module, and it is not merely a grouped progress section — each Workstream is functional and supports the fields described below. 

6.6.2 A Workstream has a name, for example Housing, Schools, or Travel and Arrival, which can be created, renamed, and duplicated. 

6.6.3 A Workstream has a purpose or outcome describing what this component needs to accomplish, editable and refinable with Whitby. 

6.6.4 A Workstream has a priority describing its relative importance and sequence within the Workplan, changeable and reorderable by dragging. 

6.6.5 A Workstream has an owner, the professional or team member primarily responsible, assignable and reassignable. 

6.6.6 A Workstream has a status of Not Started, Active, Waiting, Paused, or Complete, or an equivalent controlled value. 

6.6.7 A Workstream has a target date for when the component should reach its outcome, editable by the professional. 

6.6.8 A Workstream has a next action describing the immediate next move for this component, editable and capable of generating a Task directly. 

6.6.9 A Workstream has dependencies or a waiting-on state, referencing other Workstreams, Tasks, approvals, people, providers, or information that is blocking progress, linkable and resolvable. 

6.6.10 A Workstream has a progress indicator reflecting its current state, updatable manually or derived automatically where appropriate, based on meaningful work rather than an arbitrary percentage. 

6.6.11 A Workstream contains its own supporting items — Tasks, Worksheets, Forms, Checklists, Providers and Contacts, Documents, Key Dates, and Decisions and Approvals — addable and linkable from inside the Workstream itself, as detailed in Section 6.7. 

6.6.12 A Workstream has its own Considerations, Whitby’s insights relevant specifically to that component, reviewable, dismissible, resolvable, or convertible into an action. 

6.6.13 A Workstream is completed once its outcome is achieved, while its supporting history remains preserved; a completed Workstream can be reopened if the user is authorized to do so. 

6.6.14 A Workstream’s participation can be narrowed from the overall Request participant list to the specific professional team members, Client Contacts, and external participants actually involved in that component. Professional team members on a Workstream can be added, removed, and have their lead role assigned or reassigned, and can have Tasks assigned to them directly. Client Contacts relevant to the Workstream, such as the Requestor, a Decision-Maker, an Approver, or an Authorized Representative, can be linked from their existing canonical record and have their role identified. External participants, such as Providers, advisers, or vendors, can be linked from their existing record with their role or responsibility identified. Being linked to a Workstream never automatically grants portal, Request, or conversation access; permissions remain controlled entirely separately. 

#### **6.7 Supporting Items Inside a Workstream** 

6.7.1 Tasks are specific actions with an owner, collaborators, status, priority, due date and time, waiting state, dependency, next action, and completion evidence; a Task can be reassigned and shared with teammates and surfaces in the global My Tasks and Team Tasks views. 

6.7.2 Worksheets are structured working tables used inside coordination work, with examples including a provider comparison, a budget, an itinerary, a schedule, an inventory, a manifest, a guest or contact list, a research matrix, a decision table, or a call log. A Worksheet can be started blank, from a template, by duplicating an existing one, or built with Whitby; Worksheets remain intentionally lightweight rather than recreating a full database builder. Each row of a Worksheet can be turned directly into action: creating a Task, linking a Provider, 

creating a Decision or Approval, creating a Calendar event, or adding a follow-up, all while preserving the link back to the originating Worksheet row and context. 

6.7.3 Forms are structured information-collection instruments, with examples including intake, preferences, traveler information, provider information, or confirmations. A Form can be saved, edited, duplicated, and turned into a template; it can be sent or shared, made available through the portal, or embedded on the professional’s website where supported; every submission links back to its source records rather than creating an orphaned record. 

6.7.4 Checklists are repeatable step lists used when a full Task record is unnecessary, with examples including document collection, pre-departure checks, event readiness, or provider verification steps. A Checklist can come from a Playbook or be specific to a single Workstream. 

6.7.5 Providers and Contacts linked to a Workstream can be sourced, compared, contacted, selected, and held as a backup, always reusing the canonical Contact, Company, or Provider record. 

6.7.6 Documents linked to a Workstream include proposals, confirmations, briefs, generated documents, and supporting evidence, and are governed by the same visibility and source and version context rules as documents elsewhere in the system. 

6.7.7 Key Dates are dates that materially drive a Workstream, such as an appointment, a deadline, a travel date, a decision date, or a confirmation date; a Key Date can link to the Calendar without every single due date becoming a full calendar event. 

6.7.8 Decisions and Approvals are structured records — not merely Notes — containing options, a recommendation, the approver, a due date, conditions, an amount or threshold where relevant, supporting evidence, a status, and a result. 

#### **6.8 Considerations** 

6.8.1 A Consideration is a Whitby-generated insight that helps the professional notice a gap, a conflict, a dependency, a risk, or a useful next move, without automatically changing the Workplan. A Consideration is something to notice, not automatically a Task or a plan change. 

6.8.2 A Missing Information Consideration flags information that has not yet been confirmed, for example that a housing budget has not been set; the professional can dismiss it, resolve it, add a Task from it, or ask Whitby about it, and the system shows the source and context for why it matters. 

6.8.3 A Dependency Conflict Consideration flags a timing conflict between two parts of the plan, for example a school application deadline occurring before the current housing decision date; the professional can review it, adjust the relevant Workstream or Task, or dismiss it, and the system must never silently reorder the plan on its own. 

6.8.4 A Stale Information Consideration flags information that has not been recently confirmed, for example a provider’s availability last confirmed twenty-one days ago; the professional can create a follow-up, mark it current, or dismiss it, and the source and date are retained. 

6.8.5 A Risk or Backup Gap Consideration flags a missing contingency, for example that no backup transportation provider has been identified; the professional can add a sourcing action or dismiss it; this insight remains only an insight until the professional acts on it. 

6.8.6 A Calendar or Timing Conflict Consideration flags a planned appointment conflicting with an existing connected calendar event; the professional can review the calendar, reschedule, or dismiss it, and the connected external calendar remains authoritative. 

6.8.7 A Requirement Prompt Consideration flags an unconfirmed requirement, for example unconfirmed accessibility or language requirements; the professional can add a Form or Task, or dismiss it, and Whitby must never assume the answer on its own. 

6.8.8 A Potential Next Action Consideration flags a useful opportunity to move forward, for example that two viable provider options are ready for comparison; the professional can open a Worksheet, create a comparison, or dismiss it; the recommendation always remains reviewable rather than automatically actioned. 

6.8.9 A Consideration’s scope may apply to the entire Workplan or to one specific Workstream, and Considerations can be filtered by Workplan, Workstream, or status; resolved or dismissed Considerations retain a lightweight history where useful. 

#### **6.9 Providers on a Request** 

6.9.1 A Request’s Provider activity covers sourcing criteria, candidates, outreach, comparison, selection, backups, and the ultimately selected provider. 

6.9.2 Only deliberately shared Provider options and details are made visible to the client; the full underlying sourcing and comparison activity remains internal by default. 

6.9.3 Request-specific Provider activity can feed the Request’s Timeline. 

#### **6.10 Decisions and Approvals on a Request** 

6.10.1 A Decision or Approval is a structured object, distinct from a Note, containing the decision or action, the requester, the decision-maker or approver, the options, the recommendation, the due date, any conditions, an amount or threshold where relevant, supporting evidence, a status, and a result. 

6.10.2 The client can respond to a Decision or Approval only where they are specifically assigned or permitted to do so. 

#### **6.11 Messages and Calendar on a Request** 

6.11.1 A Request’s Messages and Calendar area shows relevant threads, drafts and sent items, meetings, appointments, key dates, and original source links. 

6.11.2 Normal permission rules apply, and any connected external Gmail, Outlook, or calendar system remains authoritative where connected. 

#### **6.12 Notes on a Request** 

6.12.1 Notes capture internal research, observations, judgment, decision background, and handling instructions. 

6.12.2 Notes are internal by default and remain distinct from Messages and Communications, unless deliberately transformed and shared through another object. 

#### **6.13 Risks and Backups on a Request** 

6.13.1 A Risk or Backup record contains the risk, its impact, the mitigation, the backup plan, the trigger, and the contingency or exception state. 

6.13.2 Risks and backups are usually internal, and maintaining them is treated as part of responsible coordination rather than an optional extra. 

#### **6.14 Timeline on a Request** 

6.14.1 The Timeline is a contextual, chronological summary of meaningful activity: work performed, communications, changes, decisions, approvals, provider activity, deliverables, exceptions, and completion events. 

6.14.2 The Timeline is not itself a global navigation item; it is summary and history, and the underlying source records remain the authoritative version of the truth. 

6.14.3 The client sees only the client-facing manifestations of the Timeline that are appropriate for them to see. 

6.14.4 There is no global Client-facing Timeline; Timeline is a Request-contextual concept. 

#### **6.15 Progress Updates on a Request** 

6.15.1 A Progress Update is how the professional or team tells the client where an active Request currently stands. It is usually linked to a specific Request and follows a draft, review, and publish flow. 

6.15.2 A Progress Update is distinct from the general Plans & Updates concept described in Section 7.6, and the system must never merge the two. 

#### **6.16 Closeout** 

6.16.1 Closing out a Request requires the definition of done, completion evidence, any unresolved items, a provider review where applicable, a final Work Summary, and, if appropriate, marking the closed Workplan as a Playbook candidate. 

6.16.2 An approved Work Summary can be shared with the client. 

6.16.3 The professional closes or completes a Request rather than deleting it; closing preserves history, and an authorized user may reopen a closed Request. 

6.16.4 The full closeout flow is: confirm the definition of done, confirm unresolved items and any handoffs, confirm completion evidence, produce the Work Summary, produce a client-safe 

summary if needed, close the Request, and then optionally save the sanitized Workplan as a new or updated Playbook. 

### **7. Tasks, Forms, Playbooks, Messages, Calendar, and Updates** 

#### **7.1 Task Capability** 

7.1.1 A Task can be assigned to the professional themselves or to a permitted teammate, and can be reassigned where the user’s role permits it. 

7.1.2 A Task may support collaborators or watchers where useful, without overbuilding this capability. 

7.1.3 The global Tasks views are: My Tasks, Team Tasks, Due Today, Upcoming, Waiting, Overdue, and Completed. 

7.1.4 A Task’s core fields are: owner, due date and time, priority, status, waiting state, dependency, next action, the linked Request or Workstream, visibility, and completion evidence. 

7.1.5 Team Tasks are visible according to workspace and team permissions, while clientassigned and client-visible Tasks remain separately and independently permissioned. 

7.1.6 A Task can be created and assigned directly from a Message, a Client, a Contact, a Provider, a Request, a Form submission, a Document review, a Decision or Approval, or a Timelinerelevant event. 

#### **7.2 Form Capability** 

7.2.1 The professional can create and edit reusable, structured Forms without developer involvement wherever possible. 

7.2.2 A Form can be saved as a template for intake, preferences, provider requirements, confirmations, and other recurring uses. 

7.2.3 A Form or template can be duplicated and the copy edited without altering the original. 

7.2.4 A Form can be sent or assigned to a Client, Member, Authorized User, Contact, Provider, or other participant; every submission links back to the Client or Request and to the source person. 

7.2.5 A V1-compatible path to embed or share approved Forms on the professional’s own website is preserved; every submission from an embedded Form must map into Whitby rather than creating an orphaned record. 

7.2.6 A Form submission moves through a lean, configurable review state such as Draft, Awaiting Response, Submitted, Needs Review, Accepted, or Correction Required. 

7.2.7 A Form respects the standard Internal, Client Visible, and Restricted visibility levels; a respondent’s ability to complete a Form never implies broader Request access. 

#### **7.3 Playbook Capability** 

7.3.1 The professional can create, edit, and save reusable Playbooks representing an operating structure. 

7.3.2 An existing Playbook can be duplicated as a new, independently editable Playbook. 

7.3.3 A Playbook preserves meaningful version history; a later edit to a Playbook never silently modifies any Workplan that is already active and was built from an earlier version. 

7.3.4 A Playbook is used by starting a Workplan from it, after which the resulting Workplan is adapted freely to the current Client and Request. 

7.3.5 A successfully completed Workplan can be converted into a new or updated Playbook after its client-specific information has been sanitized out. 

7.3.6 A Playbook’s contents include its Workstream structure, Tasks, milestones and dependencies, Forms, Worksheets, Checklists, decision points, risk prompts, and supporting templates or resources. 

7.3.7 A Playbook can be shared at the My, Shared, or organization level, subject to plan and permissions, while preserving a future seam for Academy or enterprise training tie-ins without turning Playbooks into Academy content themselves. 

#### **7.4 Messages** 

7.4.1 Messages represent actual connected or portal correspondence, supporting read, reply, and draft actions, linking to a Client or Request, and allowing a permitted professional teammate to be added to a thread. 

7.4.2 A client-side participant can only be added to a Message thread under the separate access rules described in Section 5.6 and Section 8. 

7.4.3 A Task can be created and assigned directly from a Message, preserving the source link and thread context rather than unnecessarily copying the email body into a new record. 

7.4.4 An existing Message can be linked to a Request, or added to a Request through the Add to Request workflow described in Section 2.5; Whitby may suggest a resulting Task, Note, decision, provider update, date, or Workplan change, and the professional reviews any material effect before it takes hold. 

7.4.5 A Communication is a manually logged phone call, meeting, in-person discussion, or a summary of a text or WhatsApp interaction that falls outside a supported synced channel; it is created through Quick Add → Communication and remains a distinct record type from a Message. 

#### **7.5 Calendar** 

7.5.1 The professional’s Calendar is a consolidated view built from connected Google and Outlook calendars, plus linked Whitby coordination context. 

7.5.2 A Calendar event can be linked to a Client, Request, Contact, or Company; the connected source calendar remains authoritative, and creating or updating an event is supported where allowed, with human review required for any consequential change. 

7.5.3 Only deliberately client-visible and permitted events appear in the Client Portal’s Calendar; the system must never assume a client’s personal calendar is connected in this version. 

#### **7.6 Plans & Updates and Progress Updates** 

7.6.1 Plans & Updates capture Client or relationship context that may matter but does not automatically become a Request, with examples including a travel plan, a surgery, a new residence, an assistant change, or unavailable dates. 

7.6.2 A Plans & Updates entry never automatically creates a Request; the professional may later link or create a Request or Task from it if coordination becomes necessary. 

7.6.3 A Progress Update, by contrast, is how the professional or team tells the client where an active Request currently stands, as described in Section 6.15. 

### **8. Providers** 

#### **8.1 Provider Model** 

8.1.1 A Provider is an existing Contact, Company, or both, carrying a Provider role or status; the system never creates a duplicate provider entity. 

8.1.2 Provider readiness moves through Prospect, Screened, Qualified, and Preferred, representing a trust-for-use dimension that is kept separate from outreach progression. 

8.1.3 A Prospect is a potential provider that has been identified but not yet reviewed enough for use; a Prospect may come from search, referral, an existing relationship, an inbound inquiry, or an approved source. 

8.1.4 Screened means basic fit and minimum information or evidence has been reviewed; Screened status is not equivalent to an endorsement or a guarantee. 

8.1.5 Qualified means the professional has completed the required review and considers the provider suitable for consideration or use; this is a human-controlled status, and the evidence, source, and review date behind it are preserved. 

8.1.6 Preferred means a stronger established relationship or demonstrated performance exists, and this provider is generally favored when appropriate; this is a human-controlled status and is never an automatic AI promotion. 

8.1.7 Administrative states such as Inactive or Excluded are kept outside the main quality ladder, and the reason and history behind such a state are preserved. 

#### **8.2 Outreach Pipeline** 

8.2.1 Ready to Contact means enough information exists to begin outreach. 

8.2.2 Contacted means initial outreach has been sent or logged. 

8.2.3 Replied means the provider has responded. 

8.2.4 Follow-Up means additional outreach or action is required, and the next-contact date or Task should be linked. 

8.2.5 Closed / No Further Outreach means no further outreach is expected for the current purpose, while the relationship history is preserved. 

#### **8.3 Provider Detail** 

8.3.1 A Provider’s Overview shows readiness status, category or specialty, market or service area, relationship owner, primary contact, current next action, and a relationship summary. 

8.3.2 A Provider’s Evidence and Review area shows the source, verification or review status, the last verified or reviewed date, qualifications or credentials where relevant, restrictions, and any missing information. 

8.3.3 A Provider’s Outreach area shows the outreach state, the last contact date, the next followup date, the response state, and linked Messages, Communications, and Tasks. 

8.3.4 A Provider’s Requests area shows every Request where this provider was considered, compared, selected, used, or retained as a backup. 

8.3.5 A Provider’s History area shows prior Request involvement, performance or experience notes where appropriate, the Timeline, documents, and Notes. 

#### **8.4 Sourcing** 

8.4.1 Sourcing criteria translate a Request’s outcome into category, location or service area, timing, availability, budget or terms, requirements, restrictions, and evidence needs. 

8.4.2 Comparison of viable options is performed consistently, supporting a primary option or options, backups, and flags for missing evidence. 

8.4.3 A future sourcing seam is preserved — source-run, source, evidence, and event hooks or their equivalent — so that approved automated sourcing can be added later without this version needing full autonomous sourcing. 

8.4.4 A future outreach seam is preserved — event and approval hooks or their equivalent — so that approved automated email, SMS, WhatsApp, or call outreach can be added later, while this version remains fully human-approved. 

8.4.5 Provider and Request records are able to support future service-level expectations — response windows, follow-up timing, exceptions, escalation, and performance reporting — without requiring a redesign when those capabilities are added. 

#### **8.5 Client Presentation of Providers** 

8.5.1 The client never browses the full provider database directly; the professional deliberately shares a lightweight Provider Option inside the relevant Request. 

8.5.2 A client-facing provider option carries its own status: Option for Review, Shortlisted, Selected, or Confirmed. 

8.5.3 The client-visible content of a shared provider option includes the provider or company name, the relevant contact, the category or specialty, the location or service area, a short reason for consideration, appropriate verified qualifications, availability, pricing or terms where appropriate, supporting material, and the next step. 

8.5.4 The client may Select Provider, choose Not This One, Ask a Question, or Compare Options where useful. 

8.5.5 The following remain internal and are never shown to the client: internal scoring or research, the sourcing method, rejected options, internal notes, the raw outreach pipeline, other clients’ usage of the same provider, internal margins or costs, and unresolved internal concerns. 

#### **8.6 Provider and Service Taxonomy** 

8.6.1 One configurable Category and Subcategory taxonomy describes what a Provider or Company can help with; the full taxonomy is described in Section 10. 

8.6.2 A single Contact or Company may carry multiple Categories and Subcategories simultaneously; an optional Specialty or Capability field can add further searchable detail. 

8.6.3 The same taxonomy powers Provider profiles, Request sourcing criteria, search and filtering, comparisons, and reporting; the system never creates a duplicate, parallel classification system for any one of these uses. 

8.6.4 The current build’s taxonomy scope is limited to Category, Subcategory, Specialty or Capability where useful, active and inactive controlled values, and many-to-many relationships between records and taxonomy values. The deeper Resource Types and Subtypes, scoring, coverage targets, source-run logic, and other sourcing mechanics described in the reference taxonomy workbook are supplemental and future-facing unless specifically confirmed as required for this version. 

### **9. Visibility, Team, and Permissions** 

#### **9.1 Visibility Levels** 

9.1.1 Internal means professional-side only, and an Internal object is never shown in the Client Portal. 

9.1.2 Client Visible means an object may be shown to permitted client-side participants, provided their underlying Client, Request, and conversation access also allows it. 

9.1.3 Restricted means an object is available only to specifically approved people or roles, and broader account or team rules never override a Restricted setting. 

#### **9.2 Professional-Side Permission Layer** 

9.2.1 A workspace role controls what a professional user can do across the entire workspace; lean starting roles include Owner, Admin, Team Lead, Coordinator, Billing, and Viewer, or an equivalent set the client recommends. 

9.2.2 Team and assignment settings control whether a user can see team-level Clients, Requests, Tasks, Messages, and workload, versus only the work assigned specifically to them. 

9.2.3 Record-level assignment controls owner, assignee, and collaborator access on individual records where applicable. 

9.2.4 A record marked Restricted is visible only to named or explicitly permitted professional users or roles. 

9.2.5 Only authorized admins can change roles, access ceilings, controlled classifications, and other high-risk settings. 

#### **9.3 Client-Side Permission Layer** 

9.3.1 Client account configuration sets the maximum portal capabilities available to that particular Client. 

9.3.2 Member and Authorized User scope determines which Members, which Requests, and which functions a given person may access. 

9.3.3 Request visibility is one of Private to Requestor, Selected People, or Client Account / All Permitted Members, as described in Section 5.6. 

9.3.4 Conversation participants can be a narrower set than the people who have Request access. 

9.3.5 Every object type — Documents, Forms, Tasks, Updates, Calendar events, Provider options, and other objects — independently respects the Internal, Client Visible, and Restricted visibility levels. 

#### **9.4 Audit** 

9.4.1 Material access changes record the actor, what changed, when it changed, and the previous value or reason where useful. 

9.4.2 Team changes track assignments, reassignments, and role or permission changes where material. 

9.4.3 Client invitations track Pending, Accepted, Expired, and Revoked states, along with a history of resend, suspend, and revoke actions. 

### **10. Provider and Service Taxonomy Reference** 

10.1 The taxonomy provides a shared, configurable structure for categorizing the services and capabilities available across the platform. Contacts and Companies remain the underlying 

canonical records; Provider is a role or status on those records; Category, Subcategory, and an optional Specialty or Capability describe what that Provider can help with. 

10.2 A Provider may belong to multiple Categories and Subcategories simultaneously. The same taxonomy is reused across Provider profiles, Request needs, sourcing, search and filtering, comparisons, and reporting, so the platform uses one consistent service language rather than separate classification systems in different areas. 

10.3 The detailed taxonomy workbook supplied by the client is a reference starting point rather than a requirement to hard-code every existing category or older sourcing and scoring rule into this version. Taxonomy values are configurable through Admin so the taxonomy can evolve without further development work. 

10.4 The reference taxonomy currently defines twenty-four top-level Categories: Admin / Documents, Aviation, Dental, Education, Family Support, Financial / Tax, Home Services, Hospitality / Experiences, Household Staffing, Housing / Relocation, Insurance, Language, Legal, Medical, Mental Health, Personal Assistance, Pets, Property / Residence, Security / Safety, Technology Support, Transportation, Travel, Wellness / Personal Care, and Other / Needs Review. 

10.5 Each Category carries a default sensitivity level of either Normal or Sensitive, and defines which underlying Resource Types apply to it, whether it is eligible for Provider status, whether it is eligible for sourcing, and whether it is eligible for coverage tracking. 

10.6 Each Category subdivides into a configurable set of Subcategories; the reference workbook currently defines over two hundred and fifty Subcategories in total across the twenty-four Categories, each with its own identifier, sort order, active flag, default sensitivity, and sourcing and coverage eligibility metadata. These detailed Subcategory-level records are supplemental reference data for this version and should be imported and reviewed by the client before being treated as final. 

10.7 A supplemental Resource Type model exists alongside the Category and Subcategory taxonomy, distinguishing Individual, Organization, Location, Program, Digital Resource, and Other, each with its own set of Resource Subtypes. This model is retained for future or nonprovider resource expansion and must never be used to replace the canonical Contact or Company record. A resource classified as Other always requires an Other Description field to be completed. 

10.8 A Service is explicitly not a Resource Type; services and capabilities are represented entirely through the Category and Subcategory fields described above. 

10.9 A supplemental Markets reference list defines Global Region, Country, State or Province or Territory, and City for use in describing a provider’s or partner’s service area; this list is reference data supporting sourcing and reporting. 

10.10 A supplemental Weighting reference model assigns a configurable baseline sourcing depth — a target class, a baseline pull, a coverage target, and a minimum floor — to every taxonomy Subcategory, intended to guide future automated sourcing. This weighting model, along with detailed scoring, normalization, gating, deduplication, evidence, promotion, and audit concepts 

referenced in the taxonomy workbook, is preserved for future sourcing design and is not a requirement for this version unless the client specifically confirms it should be. 

10.11 The system must not populate its provider or resource database with every searchable place, park, store, restaurant, attraction, or public listing. A resource is retained only when it has recurring operational value, supports an approved Category or Subcategory, or is intentionally promoted from a Request or a review. 

### **11. Integrations and Settings** 

#### **11.1 Integrations** 

11.1.1 Gmail supports read, link, summarize, and extract actions for context, and supports draft or approved send actions where supported; Gmail itself remains the source of truth. 

11.1.2 Outlook Mail supports the same professional email context and use as Gmail, with Outlook remaining the source of truth. 

11.1.3 Google Calendar supports the professional’s Calendar view, event linking, extraction, and conflict awareness, and supports create and update actions where supported; Google Calendar remains the source of truth. 

11.1.4 Outlook Calendar supports the same calendar context and use as Google Calendar, with Outlook Calendar remaining the source of truth. 

11.1.5 Stripe supports subscription and payment awareness and supported payment actions; Whitby stores safe status and reference metadata only, never raw card data. 

11.1.6 QuickBooks Online supports scoped customer, invoice, payment, and accounting awareness, and draft invoice support if included; Whitby is never the accounting ledger of record. 

11.1.7 Every integration’s connection state is one of Connected, meaning it is functioning normally; Needs Attention, meaning there is an authentication, permission, synchronization, or retry issue; Disconnected, meaning a previously configured connection is no longer active; or Available, meaning a supported integration exists but has not yet been configured. 

11.1.8 Every connection tracks the connected account or user, the granted permissions or scopes, the last sync time, the sync or error state, retry behavior, and a disconnect action. 

#### **11.2 Settings** 

11.2.1 Profile covers the professional user’s own profile and contact settings. 

11.2.2 Workspace covers the workspace name, defaults, selected classifications, and operating defaults. 

11.2.3 Team & Users covers inviting and managing professional team members and their assignments. 

11.2.4 Roles & Permissions covers the professional-side access controls and Restricted-data behavior described in Section 9. 

11.2.5 Notifications covers user preferences plus any configurable event-driven attention rules. 

11.2.6 Whitby / AI covers plan- and role-appropriate AI controls, usage-allowance visibility, and admin controls over AI behavior. 

11.2.7 Client Portal covers portal defaults, available client-side capabilities, invitations, and default visibility settings. 

11.2.8 Billing & Plan covers subscription, plan, and billing status, and relevant usage and entitlements. 

11.2.9 Security & Privacy covers workspace security, privacy, and retention or export controls as supported. 

11.2.10 Data / Import / Export covers approved data-movement and administrative actions. 

11.2.11 Authorized admins can add, rename, reorder, and deactivate controlled values such as Client Types, Company classifications, Provider specialties, Request categories, priorities, Document types, and tags, without changing the underlying schema or navigation. 

11.2.12 Authorized admins can add, rename, reorder, and deactivate the Provider and Company Categories, Subcategories, and supporting Specialty or Capability values described in Section 10, without changing the underlying schema or navigation, and the same taxonomy continues to power classification, sourcing criteria, search and filtering, comparisons, and reporting wherever it is used. 

### **12. Whitby AI and Future-State Seams** 

#### **12.1 Whitby AI Actions in This Version** 

12.1.1 Clarify Request: Whitby reads context, identifies ambiguity or missing information, and drafts questions or Forms; the professional reviews the result. 

12.1.2 Build Workplan: Whitby drafts or adapts the Workplan, its Workstreams, Tasks, and Work Products; the professional approves or edits the result, and version history is preserved. 

12.1.3 Summarize Messages and Documents: Whitby summarizes content and extracts dates, people, companies, requirements, commitments, decisions, and possible next actions, while preserving source and deep links and indicating uncertainty where relevant. 

12.1.4 Create reversible internal work: Whitby may draft or create Tasks, Forms, Worksheets, Checklists, Notes, comparisons, and other internal, reversible records where permitted; the user can accept, correct, modify, dismiss, delete, or revise this work as their permissions allow. 

12.1.5 Draft communications and Updates: Whitby prepares a draft email, message, or Progress Update; any material external send always requires human review and approval. 

12.1.6 Provider research organization: Whitby drafts sourcing criteria, normalizes information, flags missing evidence, and organizes comparisons; the human verifies provider facts and controls any Qualified or Preferred promotion. 

12.1.7 Spending and commitments: Whitby reads context and flags thresholds, but never makes an autonomous commitment or spends money in this version. 

12.1.8 Permissions: Whitby may explain or recommend a permission change where allowed, but never makes an autonomous access change in this version. 

#### **12.2 Source and Information State** 

12.2.1 Source content — the original Message, Document, Calendar event, Form submission, URL, or other authoritative input — remains traceable at all times. 

12.2.2 Whitby-derived structured data must be reviewable and correctable before it is used for anything consequential. 

12.2.3 Information that the user has confirmed, or that comes from an authoritative connected system, must be visibly distinguishable from Whitby’s own inference. 

12.2.4 Whitby flags information that is potentially stale or conflicting, and shows its source and context, rather than silently deciding which version is correct. 

#### **12.3 Future Seams to Preserve Without Overbuilding** 

12.3.1 For Private Attaché Academy: preserve a shared master identity and entitlement system, a product switcher or a secure handoff mechanism, course and program status events, and training-workspace eligibility, without placing Academy course management inside the Professional navigation. 

12.3.2 For provider sourcing: preserve source and evidence lineage, sourcing criteria, candidate records, review status, and event hooks, without requiring a full autonomous sourcing engine in this version. 

12.3.3 For provider outreach automation: preserve an approval state, an outreach owner, a channel, a follow-up date, a response event, a Request link, and an audit trail, without requiring autonomous external outreach in this version. 

12.3.4 For service-level expectations: preserve status timestamps, waiting state, follow-up dates, due and target dates, ownership, exception and escalation events, and response and performance reporting hooks, without hard-coding any commercial service-level promise before a final model is defined. 

12.3.5 For proactive coordination: the event model should support future detection of stale waiting items, missing next actions, approaching deadlines, missing documents, and failed provider responses; this version can surface deterministic attention items before any deep autonomous action is built. 

12.3.6 For communications: preserve the channel, participant, and source model so that SMS, WhatsApp, voice, or a shared inbox can be added later, without forcing any of these channels into this version. 

12.3.7 For enterprise: preserve workspace and team boundaries, audit, entitlements, roles, organization records, and integration seams, without requiring full self-service enterprise provisioning in this version. 

12.3.8 The event model: Requests, Tasks, Forms, Messages, Documents, Providers, decisions, Calendar, and Insights should all emit a consistent, meaningful event stream capable of powering the Timeline, the Home briefing, notifications, reports, and future automations, avoiding separate, one-off event logic for every individual module. 

### **13. Client Portal** 

#### **13.1 Terminology** 

13.1.1 The Professional is the person or organization subscribing to and using Whitby professionally. 

13.1.2 The Client is the Professional’s customer or client relationship. 

13.1.3 A Message is a conversation. 

13.1.4 An Update is something the client wants the professional to know, for example that they are going to Barcelona next month, or that a household assistant has changed. 

13.1.5 A Request is something the client needs coordinated. 

13.1.6 A Progress Update is where active work stands, communicated from the professional to the client. 

#### **13.2 Navigation** 

13.2.1 The Client Portal uses the same expandable left-navigation pattern as the Professional Workspace, not a horizontal top-tab pattern. 

13.2.2 The main navigation contains: Home, Requests, Calendar, Messages, Updates, Forms, Documents, Billing, and Integrations. 

13.2.3 Tasks is not a main navigation item. Client tasks, approvals, confirmations, forms, and uploads all surface through the Action Needed area of Home instead. 

13.2.4 Profile & Settings is kept under the avatar or account menu, not in the main navigation, and contains Profile & Contact Details, Preferences, Notifications, People & Access, Security, and Privacy. 

13.2.5 The Client Portal uses the same underlying Whitby records as the Professional Workspace; what the client sees is governed entirely by permissions and visibility rather than by a separate data model. 

13.2.6 The access hierarchy is: the professional defines the Client account’s available capabilities; Request access can narrow who sees a specific Request; conversation access can be narrower still; Restricted settings override any broader access. 

13.2.7 There is no global Client-facing Timeline. Internal Notes, full Workplans, internal provider research and scoring, risks, internal AI output, professional-only Tasks, and internal discussion are never exposed unless intentionally shared. 

#### **13.3 Home** 

13.3.1 Home’s sub-navigation is Overview, Action Needed, and Recent Activity. 

13.3.2 The client can see active Requests, upcoming items, recent Progress Updates, and shared items. 

13.3.3 The client can complete Forms, upload or review Documents, approve, confirm, and answer questions directly from Home. 

13.3.4 Only client-visible activity appears on Home. Tasks, decisions, and approvals surface within Action Needed rather than as separate main-navigation modules. 

#### **13.4 Requests** 

13.4.1 Requests sub-navigation is All Requests, Active, Waiting, Completed, and New Request. 

13.4.2 The client can create a new Request. 

13.4.3 The client can view the permitted status, next step, Progress Updates, Messages, Calendar items, Forms, shared Documents, client actions, intentionally shared provider options, and completion information for each Request. 

13.4.4 Where allowed, the person who created a Request may add another permitted Member or Authorized User from the same Client account to that Request. 

13.4.5 Request visibility follows the same three options described in Section 5.6: Private to Requestor, Selected People, or Client Account / All Permitted Members. 

13.4.6 Adding someone to a Request grants them access only to the permitted client-facing contents of that specific Request, never to any other Request or to unrelated account information. 

13.4.7 The professional can restrict or override a client’s Request access at any time, particularly for sensitive matters. 

13.4.8 Internal Workplans, Notes, research, scoring, risks, professional-only Tasks, and internal AI output remain hidden from the client at all times. 

13.4.9 The client-safe Request detail view — described further in Section 13.11 — is the primary way a client opens and understands a single Request. 

#### **13.5 Calendar** 

13.5.1 Calendar sub-navigation is Upcoming, Meetings & Appointments, Key Dates, By Request, and Past. 

13.5.2 The client can view relevant meetings, calls, appointments, travel, events, deadlines, and key dates. 

13.5.3 Internal professional deadlines are not automatically visible to the client. 

13.5.4 Google Calendar and Outlook Calendar connections for the client are managed under the Integrations area, described in Section 13.9. 

#### **13.6 Messages** 

13.6.1 Messages sub-navigation is Conversations, Unread, and By Request. 

13.6.2 The client can send and reply to messages, and, where allowed, add a permitted existing Additional Member or Authorized User to a conversation. 

13.6.3 Conversation participants are always explicit; the system records who added or removed a participant and when. 

13.6.4 Full prior conversation history versus visibility only from the point a participant was added can be controlled per conversation or per configuration. 

13.6.5 The professional may lock participant changes on a sensitive conversation. 

13.6.6 Removing a participant from a conversation does not automatically revoke their broader Client Portal access. 

13.6.7 Adding someone to a conversation does not automatically grant them access to the entire Request; adding someone to a Request grants access to that Request’s permitted client-facing contents, and these two actions remain distinct. 

#### **13.7 Updates** 

13.7.1 Updates sub-navigation is Recent, Progress Updates, Plans & Updates, and Needs FollowUp. 

13.7.2 Progress Updates show the client where active work currently stands. 

13.7.3 Plans & Updates let the client share plans, dates, changes, context, and supporting information with the professional. 

13.7.4 A Plans & Updates entry never automatically creates a Request; the professional may later link or create a Request or Task when coordination is actually needed. 

#### **13.8 Forms** 

13.8.1 Forms sub-navigation is Action Required, In Progress, and Submitted. 

13.8.2 The client completes and submits Forms assigned to them. 

13.8.3 A Form may link to the Client, a specific Member, or a specific Request. 

#### **13.9 Documents** 

13.9.1 Documents sub-navigation is All, Action Needed, Labels, and Archived. 

13.9.2 Documents use the same simple, core Documents model shared with the Professional and Partner areas, described further in Section 14. 

13.9.3 The client can view and download documents, upload and share documents where permitted, search and filter, and create and apply their own labels. 

13.9.4 Labels are organizational only; the underlying Client, Member, and Request links, permissions, and version and source metadata remain managed behind this simple interface. 

13.9.5 The client only ever sees Documents intentionally shared with them or uploaded by them; internal files always remain private. 

#### **13.10 Billing** 

13.10.1 Billing sub-navigation is Invoices and Payment Status. 

13.10.2 The client can see invoices, amounts, due dates, payment status, and any applicable payment actions. 

13.10.3 Internal accounting detail, margins, internal pricing logic, and internal ledger detail are never exposed to the client. 

#### **13.11 Client-Safe Request Detail View** 

13.11.1 When a client opens a Request, they see the permitted status, the next step, Action Needed items relevant to that Request, Progress Updates, Messages, Calendar items, Forms, shared Documents, approvals and decisions requiring their input, intentionally shared provider options, and completion information. 

13.11.2 The client never sees the internal Professional Workplan, its Workstreams, internal Notes, internal Considerations, internal provider research or scoring, or any other internal-only content, from within this same Request detail view. 

#### **13.12 Integrations** 

13.12.1 Integrations sub-navigation is Connected Apps, Available Integrations, and Connection Status. 

13.12.2 The client can connect and manage the supported external services where enabled for their account: Gmail, Microsoft Outlook Mail, Google Calendar, Microsoft Outlook Calendar, Stripe, and QuickBooks Online. 

13.12.3 Messages, Calendar, and Billing are where the connected functionality is actually used day to day; Integrations is only where the underlying connections are configured. 

#### **13.13 Profile & Settings** 

13.13.1 Profile & Contact Details, located under the avatar menu, covers the basic client or member profile and contact information. 

13.13.2 Preferences, located under the avatar menu, covers useful client preferences without requiring an oversized profile. 

13.13.3 Notifications, located under the avatar menu, covers preferences for New Message, Progress Update, Action Needed, Form Requested, Document Shared, Approval Requested, Calendar Change, Request Status Change, and Invoice or Payment Event. 

13.13.4 People & Access, located under the avatar menu, covers the Primary Member, Additional Members, Authorized Users, Related People and Dependents, Pending Invitations, and Roles & Permissions, detailed fully in Section 13.14. 

13.13.5 Security, located under the avatar menu, covers basic account security controls. 

13.13.6 Privacy, located under the avatar menu, covers member and account privacy settings appropriate to the Client Portal. 

#### **13.14 People and Access** 

13.14.1 A Primary Member is the main person associated with the Client account, has portal login, has their own Requests, and may manage people only within the capabilities the professional has enabled for that Client account. 

13.14.2 An Additional Member is another actual Member in the Client relationship, such as a spouse, adult child, or parent, has portal login, has their own Requests, can have their own profile and privacy, and does not automatically gain reciprocal visibility into another Member’s information simply by sharing the same account. 

13.14.3 An Authorized User acts for a Member within defined permissions, has portal login, has no personal Member-level entitlement of their own, and has access limited strictly to the Member or Members, Requests, and functions they are specifically permitted for. 

13.14.4 A Dependent is a person connected to the Client who does not need portal access, has no portal login by default, and can remain a related record or become an Additional Member later if direct portal access is needed. 

13.14.5 The Professional configures, per Client account, whether Additional Members are allowed at all, the maximum number of Additional Members, whether Authorized Users are allowed at all, and the maximum number of Authorized Users. 

13.14.6 The Professional configures, per Client account, whether the Primary Member may request access for someone else, and whether the Primary Member may directly invite someone; professional-controlled invitations are the default for this version unless direct invitation is specifically enabled for that Client account. 

13.14.7 Professional approval is configurable, but a client-side user can never grant capabilities beyond what the Professional has enabled for that account. 

13.14.8 An Authorized User’s scope is defined as one Member, selected Members, selected Requests, or defined account functions. 

13.14.9 Visibility controls apply independently across Requests, Messages, Calendar, Documents, Forms, Updates, Billing, and Approvals. 

13.14.10 The Professional controls whether a Member may add permitted Additional Members or Authorized Users to a conversation, and separately controls whether a Requestor may add permitted Additional Members or Authorized Users from the same Client account to a Request. 

13.14.11 Being part of the same Client account never automatically grants access to another Member’s private Requests, Messages, or Documents. 

13.14.12 Invitation and access history is recorded with the statuses Pending, Accepted, Expired, and Revoked. 

13.14.13 A set of common permission presets is available: an Additional Member preset grants normal Member access to their own permitted Requests, Messages, Calendar, Forms, Documents, Updates, and other Member information; an Assistant preset grants permitted Requests, Messages, Calendar, Forms, Documents, and Updates for the specific Member or Members they support, with no unrelated Member access unless explicitly granted; a Limited Representative preset grants only selected Requests and the client-facing information tied to those Requests; a Billing Contact preset grants billing and invoice access without broad access to Requests or private Member information. 

13.14.14 Request visibility values are Private to Requestor, meaning only the Requestor plus permitted professional or team members can see the client-facing Request; Selected People, meaning the Requestor may add selected existing permitted Additional Members or Authorized Users from the same Client account where allowed; and Client Account / All Permitted Members, meaning the Request is visible to every client-side Member or User whose account permissions allow that level of access. 

13.14.15 Adding someone to a Request grants access only to that Request’s permitted clientfacing contents; it never grants access to other Requests or to unrelated account information, and the professional may restrict or override this access, particularly for sensitive or Restricted matters. 

13.14.16 A Member may add an existing permitted Additional Member or Authorized User to a conversation where permitted; this does not automatically add them to the entire Request. Full prior conversation history versus visibility from the point of addition can be supported based on permissions or configuration. The system records who added or removed a participant and when. Removing a participant from a conversation does not automatically remove their broader Client Portal access. The professional may lock participant changes for a sensitive or Restricted conversation. 

13.14.17 The V1 invitation flow is: the professional opens the Client, goes to People & Access, and selects Invite Person; the professional chooses Additional Member or Authorized User and enters the person’s name, email, relationship, and associated Member or Members; the professional chooses a permission preset and any Request-specific scope needed; the professional sends the invitation and the invitee accepts it and activates their login; the 

professional can subsequently resend the invitation, change permissions, suspend access, or revoke access entirely. 

13.14.18 The governing rule throughout is that the Professional defines the capabilities available to the Client account, and Members and Authorized Users can only ever act within those permitted capabilities. 

### **14. Shared Documents Model** 

14.1 One core Documents model is shared across the Professional, Client, and Partner areas of the product; each area presents this shared model through its own simple, appropriately scoped interface rather than through separate, unrelated document systems. 

14.2 Every area’s Documents view offers, at minimum, an All view, an Action Needed view, a Labels or My Labels view, and an Archived view. 

14.3 Users can create their own labels and apply one or multiple labels to a document; example labels include Agreement, Terms, Tax, Marketing, Enterprise, Academy, Platform, and a given year, but these are illustrative only, and the system never enforces a single fixed document taxonomy across all users. 

14.4 Labels are organizational only. Labels never change a document’s permissions, legal meaning, commission rules, or status. 

14.5 A document’s status is one of a small set of values: Current, Action Needed, Completed, or Archived. Status is system- or professional-controlled where needed, while labels remain entirely user-controlled. 

14.6 An Action Needed document status can link to a Review action, a Sign Externally action, an Upload action, or an Update action. 

14.7 Documents can be uploaded and shared by the professional or by Private Attaché staff, and can be uploaded by the client or partner themselves when permitted or specifically requested; an upload request carries a file, a title, optional labels, a note or request context, who shared or requested it, and a date. 

14.8 Agreements, amendments, commercial terms, guidelines, and policies are represented simply as documents within this same library and can be labeled as useful, rather than requiring a separate document system of their own. 

14.9 Important version and legal metadata — document ID, version, effective date, signed or accepted date, any replaced or superseded reference, and the storage reference — is preserved behind the simple user-facing experience; the user-created labels described above are never relied upon to determine the governing legal or commercial terms of a document. 

14.10 Document access always follows the underlying Client, Company, Partner, or user permissions, never the labels applied to a document; only permitted users ever see a given document, and internal-only notes or files always remain hidden from client- or partner-side users. 

14.11 Where a commercial or legal rule needs to link to the exact governing document and version — for example, a specific commission rule linking to the specific agreement version that authorizes it — this linkage is preserved internally without complicating the simple, userfacing document screen. 

14.12 No native electronic-signature capability is included in this version. Where a signature is required, the flow is: the document is sent externally for signature, the signer signs or accepts it externally, the final signed copy is returned, the final copy is stored in the relevant Documents area, and the document’s status is updated accordingly. 

### **15. Private Attaché Academy — Learner Experience** 

#### **15.1 Structure and Roles** 

15.1.1 Learner is the default role for every person entering the Academy. 

15.1.2 Instructor permissions are assigned only by a Private Attaché administrator; there is no self-service path to becoming an Instructor. 

15.1.3 Academy Admin, also called Content Admin, is the internal role responsible for the catalog, course creation, publishing, assessments, and overall Academy management, described further in Section 16. 

15.1.4 A learner may simultaneously hold a Whitby identity, an Academy learner identity, and a Partner identity under one shared, unified identity, with access to each governed entirely by roles and entitlements rather than by separate accounts. 

#### **15.2 Navigation** 

15.2.1 The Academy’s main navigation contains: Dashboard, My Learning, Explore, Certificates & Credentials, and Resources. 

#### **15.3 Program Catalog** 

15.3.1 The catalog includes the Certified Private Attaché program. 

15.3.2 The catalog includes the Professional Practice Accelerator, replacing any earlier reference to “Practice Builder.” 

15.3.3 The catalog includes eight named Specialty Endorsements, replacing any earlier generic or placeholder specialty examples. 

15.3.4 The catalog includes Intelligent Coordination, which is the primary free or included Whitby-related course; it must never be labeled or treated as “Whitby Product Training.” 

15.3.5 The catalog includes additional free courses. 

15.3.6 The catalog includes additional paid programs added over time, without requiring a redesign of onboarding or navigation to add them. 

15.3.7 The Certified Private Attaché program remains platform-neutral in its framing. Whitby may support applied practice and training within it, but the program itself must never read like a certification in the Whitby software specifically. 

#### **15.4 Access and Entitlement** 

15.4.1 Access to any given program is governed by purchase, entitlement, prerequisite, or administrative assignment. 

15.4.2 A purchased program automatically appears in the learner’s My Learning area. 

15.4.3 Intelligent Coordination appears wherever the learner is entitled to it. 

15.4.4 A Specialty Endorsement program respects its Certified Private Attaché prerequisite and is not accessible until that prerequisite is met. 

15.4.5 Explore buttons follow entitlement logic and display as Start, Continue, Purchase or View Program, CPA Required, or Review, depending on the specific learner’s access and status. 

#### **15.5 Dashboard** 

15.5.1 The Dashboard is the learner’s entry point into the Academy, surfacing current progress, recommended next steps, and access to My Learning. 

#### **15.6 Explore** 

15.6.1 The Explore area presents the full catalog described in Section 15.3, filterable and searchable, with each program’s action button following the entitlement logic described in Section 15.4.5. 

#### **15.7 My Learning** 

15.7.1 My Learning shows every program the learner is currently enrolled in or has purchased, with progress tracked per program. 

#### **15.8 Course Player** 

15.8.1 The course player provides curriculum navigation alongside video, readings, scenarios, and resources. 

15.8.2 The course player provides Whitby learner support in context. 

15.8.3 Whitby must never provide answers to graded content, and must never access protected assessment or question-bank content, within the course player. 

#### **15.9 Certificates & Credentials** 

15.9.1 The Certificates & Credentials area distinguishes three distinct types: the Certified Private Attaché credential, a Specialty Endorsement, and a Certificate of Completion. 

15.9.2 The Certified Private Attaché credential term is three years; any sample or displayed renewal date must reflect this three-year term. 

15.9.3 Certification progress generally follows: Required Learning, Applied Work or Submissions, Final Assessment, Credential Review, and Credential Awarded. Identity verification or proctoring gates may be added at the required stages where formally necessary, rather than being hard-coded into every program regardless of whether it is required. 

#### **15.10 Cohorts and Enterprise** 

15.10.1 Cohort or enterprise-specific screens are shown only to learners who are actually part of an organization or a private cohort; they are never shown to an individual learner outside such an arrangement. 

#### **15.11 Recommendations** 

15.11.1 The interest selections captured during Academy onboarding, described in Section 4.12, drive the “Recommended for You” experience within the Academy and never determine or restrict the learner’s actual structural access. 

### **16. Academy LMS — Administration and Content Creation** 

#### **16.1 Role Model** 

16.1.1 Learner is the default Academy role for every person. 

16.1.2 Instructor is a role assigned only by a Private Attaché Admin when needed; there is no self-service teacher or instructor sign-up anywhere in the product. 

16.1.3 Academy Admin, also called Content Admin, is the internal role responsible for the catalog, course creation, publishing, assessments, and overall Academy management. 

16.1.4 An Academy Admin can grant publishing and editing access to a specific Instructor for specific courses, since the Admin retains overall control of the catalog. 

16.1.5 Where an Instructor role is granted, it is permission-based and limited strictly to the specific programs or modules that Instructor has been assigned; creating entirely new programs and publishing new content to the live catalog normally remains Admin-controlled rather than Instructor-controlled. 

#### **16.2 Course Builder** 

16.2.1 The course-building structure is Programs → Modules → Lessons → Resources → Assessments and Question Banks → Preview → Publish. 

16.2.2 Whitby-assisted drafting is available to authorized content creators at each stage of the course-building structure. 

#### **16.3 Removed From the Instructor Experience** 

16.3.1 Enrollments & Commission is removed from the normal instructor experience. 

16.3.2 Payouts is removed from the normal instructor experience. 

16.3.3 Private Attaché Academy is not an open, self-service creator marketplace; ordinary partner commissions belong exclusively in the Partner Center, described in Section 17. Any special, individually negotiated instructor compensation is handled separately and administratively if it is ever needed, outside the normal instructor experience entirely. 

16.3.4 Stripe is removed from the LMS and from the Academy’s instructor-facing surfaces for this version; how Stripe is used consistently across all four modules of the ecosystem is to be finalized separately at the ecosystem level. 

#### **16.4 Catalog Management** 

16.4.1 The centrally managed catalog supports the Certified Private Attaché program, the Professional Practice Accelerator, the eight Specialty Endorsements, Intelligent Coordination, additional free courses, and additional paid programs added later. 

16.4.2 The Academy Admin manages programs, learners and enrollments, instructors, assessments, credentials and certificates, pricing and access, and overall Academy settings. 

#### **16.5 Teacher / Instructor Account Provisioning** 

16.5.1 There is no normal, self-service sign-up path for a teacher or instructor account. 

16.5.2 An administrator manually adds each instructor account and grants it LMS access, rather than the instructor registering themselves. 

### **17. Partner Center** 

#### **17.1 Purpose and Core Rules** 

17.1.1 The Partner Center gives an approved Partner a clear place to refer customers, submit Enterprise opportunities, see attributed conversions and earnings, manage their company and team, view documents and terms, and complete payout setup. 

17.1.2 The Partner Center never becomes a full partner-relationship-management platform, a full CRM, a full accounting platform, or an electronic-signature product; it stays deliberately lean. 

17.1.3 The Academy and Whitby platform programs use the Referrals flow described in Section 17.4. Enterprise uses a separate Opportunity workflow, described in Section 17.5, that can later become an attributed sale or conversion. 

17.1.4 A single Partner may participate in one program or in multiple programs simultaneously. 

17.1.5 Partner Company and Partner Contacts remain canonical Company and Contact records carrying a Partner relationship or role; the system never duplicates a person or a company inside the Partner Center. 

17.1.6 Whitby owns the visible attribution record and the commercial rule behind it. Cookie, link, and code data helps establish attribution, but captured identity and account attribution, together with an auditable manual-correction capability, prevent the system from depending 

on cookie data alone. The attribution window and the earning period are two separate concepts and must never be conflated. 

17.1.7 Stripe and QuickBooks may both produce eligible collected-payment events. A Stripeoriginated payment must never be double-counted when it is later synced into QuickBooks; Whitby creates an earning record only after matching one eligible collected payment to an attributed Referral or Opportunity and the active commercial terms. 

17.1.8 Stripe Connect is the planned payout rail. Sensitive tax, bank, and identity details remain inside Stripe; Whitby stores only safe readiness, status, and reference data. A Partner may refer customers before their payout setup is complete, but commissions are not actually paid out until the Partner is payout-eligible. In some cases, such as certain enterprise configurations, a partner payout may instead be made through QuickBooks, and the system must accommodate this alternative payout path. 

17.1.9 The Partner has one simple, dedicated Documents area for every file shared with them or uploaded by them, using the shared Documents model described in Section 14; Partners can create their own labels rather than being forced into a fixed document taxonomy, while important legal and commercial versioning, effective dates, permissions, and governingdocument links remain system metadata behind that simple experience. 

17.1.10 Rates, attribution windows, eligible earning periods, payment terms, cookie life, included and excluded revenue, and program availability are all configurable through Admin rather than hard-coded; for example, one partner may receive a ten percent rate while another receives twenty percent, and an enterprise partner may have entirely custom fixed or percentage terms. 

17.1.11 Partner-facing navigation uses the term Referrals for straightforward, simple flows, and the term Enterprise Opportunities for registered company-level opportunities; the phrase “introduced by” may be used as contextual relationship language elsewhere. Partner-facing wording throughout is kept simple. 

17.1.12 A partner is treated as a customer for a configurable period of thirty, sixty, or ninety days after they begin referring; the exact period is set by the client. Commissions begin only after this period elapses, and this arrangement is documented in the partner agreement. 

#### **17.2 Branding** 

17.2.1 The Partner Center is branded as Private Attaché / Partner Center throughout, never as Whitby, consistent with Section 1.5. 

17.2.2 Every reference to the legacy “Institute” name is replaced with Private Attaché Academy or Academy. 

#### **17.3 Navigation** 

17.3.1 The main navigation contains: Home, Referrals, Opportunities, Earnings, Links & Codes, Company & Team, Documents, and Messages. 

17.3.2 Settings is kept under the profile or avatar menu rather than in the main navigation. 

17.3.3 Programs is not given a prominent, standalone navigation destination. Program participation and terms are surfaced instead within Home, within Links & Codes, and within the Partner’s own profile. 

#### **17.4 Home** 

17.4.1 Home’s sub-navigation is Overview, Action Needed, and Recent Activity. 

17.4.2 Home shows program performance, referral and opportunity status, earnings, payment setup status, and next actions. 

17.4.3 A Referrals card on Home shows counts of Referred, In Progress, and Converted referrals, each clickable through to the underlying records. 

17.4.4 An Enterprise Opportunities card on Home shows counts of Submitted, Accepted / In Progress, and Converted opportunities, kept visibly separate from ordinary referrals. 

17.4.5 An Earnings card on Home shows Pending, Payable, and Paid totals, along with a summary of the partner’s configured rate and terms rather than generic, hard-coded marketing copy. 

17.4.6 A Programs & Terms card on Home shows Academy, Platform, and Enterprise, each with an Active or Inactive state and its configured rate or custom terms. 

17.4.7 An Action Needed card on Home surfaces agreement or document actions, payout setup steps, missing information, opportunity follow-ups, and unread messages. 

#### **17.5 Referrals** 

17.5.1 Referrals sub-navigation is All, In Progress, Converted, and Not Converted. 

17.5.2 Referrals cover Academy and Platform referrals, shown with product, status, and attribution context. 

17.5.3 Every referral has a system-assigned Referral ID as an immutable source record identifier. 

17.5.4 Every referral links to a referred person and, optionally, a referred company, reusing the canonical Contact and Company records. 

17.5.5 Every referral records its program family — Academy or Platform — since Enterprise uses the separate Opportunity flow instead. 

17.5.6 Every referral records the specific product where known, such as a specific Academy course or bundle, or a specific Platform plan; product definitions and pricing remain Adminconfigured. 

17.5.7 Every referral records its source: a link, a code, a manual referral, a campaign or event, or an admin attribution, and this source is preserved for audit. 

17.5.8 Every referral records a referral date, which starts the applicable attribution-window logic unless the active terms specify a different trigger; the timestamp and time zone are recorded. 

17.5.9 The attribution window is configurable at thirty, sixty, or ninety days, or a custom value, and is drawn from the terms and rules active at the moment of attribution. 

17.5.10 Once the referred person creates an account or identity during a valid attribution period, the system preserves the partner association as identity attribution rather than relying only on a browser cookie, allowing later cross-device or cross-account matching. 

17.5.11 A referral-link cookie’s lifespan is configurable by program or campaign and supports initial attribution, but a cookie alone must never be the only attribution record once identity has been captured. 

17.5.12 A referral’s external, partner-visible status is Referred, In Progress, Converted, or Not Converted / Closed; internal review notes are never exposed to the partner. 

17.5.13 The Academy conversion event is configurable, defaulting to a paid product purchase or enrollment; a free enrollment can still be tracked for enrollment or performance purposes without necessarily generating a commission, and the Admin defines earning eligibility by product. 

17.5.14 The Platform conversion event is configurable, with the recommended default being the first successful paid subscription payment; a trial or account creation alone may be tracked but is not necessarily commissionable. 

17.5.15 Every referral records the date the configured qualifying conversion event occurred, kept separate from any later payout or earning date. 

17.5.16 An attributed product or payment is linked back to its referral, with the underlying source payment coming from either Stripe or QuickBooks. 

17.5.17 An admin may manually assign or correct partner attribution, recording a reason, the acting admin, a timestamp, and the previous attribution for audit purposes; the partner only ever sees the resulting, approved attribution, never the internal audit detail behind it; every material commercial change of this kind is fully audited. 

#### **17.6 Enterprise Opportunities** 

17.6.1 Opportunities sub-navigation is All, Submitted, Accepted, In Progress, Converted, and Closed. 

17.6.2 Enterprise Opportunities cover company-level opportunity registrations for organizational sales that do not behave like ordinary tracked-link referrals. 

17.6.3 To submit an Opportunity, the partner enters the company and a contact, their product interest, the number of users or seats, timing, additional context, notes, permission to contact the prospect, and an optional attachment; Private Attaché receives a corresponding notification or task. 

17.6.4 The Opportunity’s company links to an existing canonical Company record or creates a new one, with deduplication performed before a new Company record is created. 

17.6.5 The Opportunity’s primary contact links to an existing canonical Contact or creates a new one, capturing email, phone, and title where provided, along with the captured permission to contact them. 

17.6.6 Product interest is captured as Academy Seats, Platform Users, Combined, or Other / Custom, with the exact values configurable. 

17.6.7 The Opportunity records an estimated size — seats or users, and optionally an estimated value where appropriate — understanding that this estimate is not itself the commission basis until eligible collected revenue actually exists. 

17.6.8 The Opportunity’s external, partner-visible status moves through Submitted, Accepted, In Progress, and Converted / Not Moving Forward; richer internal sales stages may exist without being exposed to the partner. 

17.6.9 When Private Attaché formally accepts an Opportunity, the system assigns a configurable protected attribution period, with a working example of one hundred eighty days; the partner sees the approved term and its expiration where appropriate, and this protected period is kept separate from the commission earning period. 

17.6.10 A commercial Opportunity may be marked won or converted at the point of a signed order or agreement, but the resulting commission should only arise from eligible collected payment under the partner’s active terms; the system avoids paying commission on uncollected revenue unless a custom rule explicitly states otherwise. 

17.6.11 The Opportunity’s payment source is either Stripe or QuickBooks, or another form of collection outside Stripe, and this collected payment is matched back to the Opportunity, the customer, and the active earning rule. 

17.6.12 An admin resolves any Opportunity reassignment or attribution conflict with a recorded reason and audit history; only the approved outcome is ever visible to the partner, and the system never silently overwrites an existing attribution. 

#### **17.7 Earnings and Attribution** 

17.7.1 Attribution determines who receives commercial credit for a Referral or an Opportunity, using windows such as thirty, sixty, or ninety days for ordinary referrals, one hundred eighty days for Enterprise, or a fully custom window; the window is configured per program, per rule, or per partner, and any manual correction is audited. 

17.7.2 The earning rule determines how commission is calculated once an eligible event occurs — for example ten percent, fifteen percent, twenty percent, a flat amount, or a fully custom rule — and partner-specific overrides of the default rule are always allowed. 

17.7.3 The earning basis determines exactly which collected payments count, for example first collected payment only, each collected payment, collected revenue for a defined period, a fixed 

amount after the first collected payment, or a custom basis; the system never hard-codes a single universal earning model. 

17.7.4 The eligible period determines how long a converted customer’s revenue continues to earn commission — for example one payment only, three months, six months, twelve months, or a custom period — and this is a distinct concept from the attribution window. 

17.7.5 Eligible revenue is defined by Admin to include or exclude specific revenue components; exclusions may include taxes, refunds, credits, AI usage overages or credits, pass-through expenses, or other non-commissionable add-ons; every set of terms stores its own version and effective dates. 

17.7.6 Payment terms determine when an approved earning becomes payable, for example monthly in arrears, subject to a hold or refund period, Net 15, Net 30, Net 60, or a custom schedule, configurable per partner or per program. 

17.7.7 An earning’s status moves through Pending, Approved, Payable, and Paid, with Held, Reversed, and Ineligible available as exception states; a partner only ever sees their own earning records. 

17.7.8 A full refund or chargeback fully reverses the associated earning; a partial refund proportionately adjusts it; if the earning has already been paid out, the reversal instead creates a negative future adjustment, with the reason and reference recorded and a ledger-style audit trail maintained throughout. 

17.7.9 A Stripe-collected sale uses Stripe’s successful-payment and invoice events along with Stripe’s customer, subscription, and payment identifiers; Stripe is the commission source of truth for any Stripe-originated collection, covering Academy checkout, Platform subscriptions, and any Stripe-paid Enterprise invoice. 

17.7.10 A QuickBooks-collected sale uses a QuickBooks Payment linked to an Invoice and customer, used only when the actual collection occurred outside Stripe, for example an ACH, wire, check, or manually recorded Enterprise payment. 

17.7.11 The system stores external source and system identifiers and de-duplicates lineage so that a Stripe payment that is later synced into QuickBooks is never counted as two separate collection events, and no two earnings are ever created from the same underlying economic payment. 

17.7.12 Earnings can be calculated and approved before a partner’s payout setup is complete, but an earning cannot move to Payable or Paid status until the partner has a current Tax Profile, a ready payout method, and no active hold; Stripe Connect is the default payout rail, with QuickBooks, ACH, or check permitted where approved. Tax identity is independent of the payment rail used, and annual reporting is aggregated across both Stripe and QuickBooks whenever the same Private Attaché payer and payee relationship applies. 

#### **17.8 Partner Programs and Economics** 

17.8.1 Three partner programs exist: Academy, Platform, and Enterprise, each independently marked active or inactive with its own effective dates. 

17.8.2 A partner-specific rate, expressed as a percentage or a flat amount with its own effective start and end dates and its own override priority, can override the default tier or program rate for that specific partner. 

17.8.3 A default program rate exists per product family or product as a baseline, for example a working example of ten percent for Academy and twenty percent for Platform, understood as an illustrative example rather than a fixed, hard-coded figure. 

#### **17.9 Links & Codes** 

17.9.1 Links & Codes sub-navigation is Program Links, Referral Links, Access Codes, and Campaign / Event. 

17.9.2 This area combines every referral-link concept into one place: Academy referral links, Whitby or Platform referral links, access codes, and campaign or event codes. 

17.9.3 The partner can copy and share their approved links and codes, and can see the currently configured attribution window that applies to them. 

17.9.4 Cookie life for a referral link is configurable by referral campaign or program, and firsttouch or last-touch attribution behavior can be supported where an external attribution service is used to support it. 

#### **17.10 Company & Team** 

17.10.1 The Partner Company area captures the company name, website, address and locations, industry or business type, markets, audience served, a primary relationship summary, and the partner’s status and program participation. 

17.10.2 The Partner Company record reuses the canonical Company record and allows normal enrichment, such as website, social, or profile data, where appropriate. 

17.10.3 The Contacts area captures name, salutation or title, role or title, email, phone, preferred contact method, Partner Center access, and contact function; every contact reuses the canonical Contact record. Contact functions include Company Admin, Referral Contact, Billing / Payment Contact, Authorized Signer, and Read Only. 

17.10.4 Company & Team also tracks Locations for the partner company and the Access level each team member holds within the Partner Center. 

#### **17.11 Documents** 

17.11.1 Documents sub-navigation is All, Action Needed, My Labels, and Archived, following the shared Documents model described in Section 14. 

17.11.2 The partner can upload, view, and download permitted files, create their own labels, rename labels, apply multiple labels to a single file, and search or filter by label, status, program, and date. 

17.11.3 Example labels include Agreement, Terms, Academy, Platform, Enterprise, Marketing, and a given year, understood as examples only; the system never imposes a fixed document taxonomy on the partner. 

17.11.4 Agreement documents include the agreement name and type, its version, its effective date, an expiration or renewal date if applicable, its status, the accepted or signed date, an external signature or reference, and the final copy. 

17.11.5 A Program Terms summary, visible to the partner, presents the current rate or fixed amount, the attribution window, the eligible earning period, the cookie or tracking rule, eligible and excluded revenue, payment terms, and the refund and chargeback treatment; the currently applicable terms are always displayed, while historical versions are retained internally and, where appropriate, externally as well. 

#### **17.12 Tax and Payment Setup** 

17.12.1 One current Tax Profile is maintained for each partner’s legal payee under the applicable Private Attaché payer entity; a partner never completes a second W-9 merely because some of their payouts happen to use Stripe while others use QuickBooks — payment rail and tax identity are treated as entirely separate concerns. 

17.12.2 A W-9 is used for applicable United States persons; the appropriate W-8 form is used for non-U.S. payees; uncertain cases are routed for review rather than guessed at in the interface. 

17.12.3 Tax Profile status is tracked independently from payment readiness, using values such as Not Started, In Progress, Complete, Needs Attention, Review Required, and, where applicable, Expired or Refresh Required. 

17.12.4 The Tax Profile stores only the minimum operational metadata Whitby actually needs: legal payee name, business or DBA name, entity or tax classification where appropriate, mailing address and country, a masked reference to the taxpayer ID showing at most the last four digits if needed, form type, certification date, collection source, an external record ID, and status. Raw Social Security numbers, Employer Identification Numbers, or bank details are never exposed or broadly stored inside Whitby; sensitive tax documents and identifiers remain in the approved secure system with restricted access. 

17.12.5 The tax-collection method can be Stripe’s tax-reporting or Connect capability, a QuickBooks W-9 invitation, or another approved secure process; ordinary Stripe Connect identity onboarding alone is never assumed to be equivalent to a valid, completed W-9. 

17.12.6 Stripe Connect is the default payout rail and the preferred hosted onboarding path for bank, business, and identity requirements; banking and identity details stay inside Stripe, with Whitby storing only status and reference data. 

17.12.7 QuickBooks, ACH, check, or another approved payout method is available when Private Attaché pays a partner outside Stripe; using QuickBooks for a payout never triggers a new W-9 request if a valid Tax Profile already exists on file for the same partner legal payee and payer entity. 

17.12.8 A partner can become Active and begin referring before their payout readiness is complete, but actual payment stays blocked until the required tax and payment setup is finished; the partner sees one simple status of Eligible, Needs Tax Setup, Needs Payment Setup, or On Hold. 

17.12.9 Annual tax reporting is aggregated by legal payer and reporting entity across both Stripe and QuickBooks whenever the same Private Attaché payer is responsible, tracking tax year, legal payer, reporting system, reportable total, the Stripe-paid total, the QuickBooks-paid total, any adjustments, and the 1099 status and reference; the goal is one consolidated tax-reporting record per payer-and-payee relationship rather than duplicate 1099s from each separate payment rail. 

17.12.10 If two legally distinct payer entities genuinely make and report separate payments to the same partner, separate tax requests and separate 1099s can legitimately arise; this is distinct from, and must not be confused with, simply using both Stripe and QuickBooks as payment rails for the same payer. 

17.12.11 The partner-facing Tax & Payment Profile stays simple and never displays sensitive identifiers; it shows the Tax Profile status, the form type, the last completed or updated date, the payment method status, payout eligibility, and available actions such as Complete Tax Setup, Complete Stripe Setup, Update Payment Method, and Contact Support. 

17.12.12 W-9, W-8, and other tax certifications are treated as restricted records rather than as ordinary Partner Documents; a partner may be able to view or download their own copy where the collection system supports it, while internal access follows least-privilege principles. 

17.12.13 Any material change to a legal payee, a taxpayer ID or tax status, a payout method, a reporting status, or a manual override is fully audited, recording the changed field, the previous and new value or status, the acting user, the date and time, the reason, and the source; the system never silently overwrites tax or payout identity. 

#### **17.13 Application and Onboarding** 

17.13.1 An application moves through Submitted, Under Review, More Information Needed, Approved / Declined, Agreement, and Active. 

17.13.2 The application captures whether the applicant is an individual or a company, the company name and website, a primary contact, their market or location, business type, audience served, referral approach, products of interest, expected activity level, and any additional context. 

17.13.3 An admin reviews the application, may request more information, approves or declines it, and assigns an owner, programs, and terms; the assignee, decision, reason, and timestamps are recorded for audit. 

17.13.4 The agreement is sent externally for signature or acceptance; the final signed copy is emailed and uploaded or stored as a permitted document inside the Partner Center; the agreement’s version, effective date, and signature or acceptance status are all tracked. 

17.13.5 A partner becomes Active once the required approval and agreement conditions are met, at which point their programs are enabled, their links and codes are created, and their Partner Center access is granted. 

17.13.6 Around the time of approval, the partner completes their required Tax Profile plus their selected payout setup; Stripe Connect is the default payout rail, though QuickBooks or another approved payout method may be used instead. The Tax Profile status values are Not Started, In Progress, Complete, and Needs Attention; the payment setup status values are Not Started, Incomplete, Ready, and On Hold; payout eligibility is the combination of both. 

17.13.7 A partner can refer customers before they are payout-eligible, so long as they are otherwise Active; earnings may accrue according to their terms, but no payout occurs until the required tax profile and payout method are both complete. 

17.13.8 An onboarding checklist tracks completion and any needed action across: company profile, primary contact, agreement and documents, programs and terms, referral link, the partner guide and policies, Tax Profile, and payout setup; the Documents item opens the simple file library described in Section 14, and the Tax Profile item links to the relevant Settings or Profile area. 

#### **17.14 Admin Configuration** 

17.14.1 An admin configures the list of partner programs — Academy, Platform, Enterprise, and any future program families — each with its own active state and effective dates. 

17.14.2 An admin configures a partner-specific rate as a percentage or a flat amount, with its own effective start and end dates and override priority. 

17.14.3 An admin configures the default program rate by product family or product. 

17.14.4 An admin configures the attribution window in days — thirty, sixty, ninety, one hundred eighty, or a custom value — along with its trigger and its own effective period; this can vary by partner, program, or campaign. 

17.14.5 An admin configures cookie life by referral campaign or program, along with first-touch or last-touch behavior where an external attribution service supports it; the cookie supports attribution, but captured identity attribution remains the canonical record after account creation. 

17.14.6 An admin configures the earning basis — first collected payment, each collected payment, collected revenue for a defined period, a fixed amount, or a custom basis — per partner or per program. 

17.14.7 An admin configures the eligible commission period — one event, thirty, sixty, or ninety days, three, six, or twelve months, or a custom period — kept separate from the attribution window. 

17.14.8 An admin configures eligible and excluded revenue by product, product family, or plan ID, specifying included fees and excluded taxes, refunds, credits, overages, and pass-through items, with the exact rule and version used for each earning stored for audit. 

17.14.9 An admin configures payment terms — payout cadence, any hold or refund period, payable timing, an optional minimum payout threshold, and Net terms or a custom schedule — with the approved summary displayed in the Partner Center. 

17.14.10 An admin configures Enterprise protection rules — whether Opportunity acceptance is required, the protection period, renewal or extension rules, and conflict resolution — with every extension or override audited. 

17.14.11 An admin can manually correct attribution, recording the new partner, the reason, the acting admin, the date, and the previous attribution; the system never silently overwrites an existing attribution. 

17.14.12 An admin configures the refund and chargeback rule — full reversal, proportional partial adjustment, or a future negative adjustment after payout — only where business policy requires a change from the default, with a full audit trail maintained. 

17.14.13 An admin configures agreement and terms versions — the agreement version, the program terms version, effective dates, the document or reference, and acceptance or signature status — with historical terms fully preserved. 

17.14.14 An admin may optionally configure an external attribution provider, such as FirstPromoter or a later equivalent, along with its provider or campaign IDs and their mapping back to the relevant Whitby partner, program, and rules; Whitby remains the visible system of record for the partner relationship and every approved earning regardless of whether an external provider is used. 

17.14.15 An admin configures the required tax form type and status, the approved collection source, the available payout methods, the payout eligibility gates, and the legal payer or reporting entity, centrally; the system never creates separate tax profiles by payout rail. 

#### **17.15 Integration Boundaries** 

17.15.1 Stripe Connect onboarding collects the partner’s business, identity, and payout requirements through Stripe’s own hosted onboarding flow; Whitby stores only status and reference data, never sensitive banking, tax, or identity details. 

17.15.2 Stripe Connect payouts pay eligible partner earnings and track each payout’s created, updated, paid, and failed events; a payout failure or an outstanding requirement creates an attention state in the Partner Center. 

17.15.3 Stripe Connect webhooks are used to receive relevant connected-account and payout events, using event IDs and idempotency handling to avoid duplicate processing. 

17.15.4 QuickBooks invoices and payments are read to capture non-Stripe collected Enterprise payments, linking each Payment to its Invoice and customer; QuickBooks is used as the source only when the collection actually occurred outside Stripe. 

17.15.5 QuickBooks webhooks receive invoice- and payment-related change notifications where the integration supports them, de-duplicated against any Stripe-originated payment lineage for the same transaction. 

17.15.6 An optional FirstPromoter integration provides an external referral, cookie, and campaign layer, supporting configurable cookie life and campaign reward structures; this external service must never become the sole canonical record of a partner or Enterprise relationship, since Whitby’s own Admin-configured terms remain authoritative for everything displayed and approved in the Partner Center. 

17.15.7 The system tracks the amount of business — for example the number of users — a given partner has brought in through QuickBooks, and provides an explicit, admin-triggered mechanism for issuing the corresponding payout once due. 

### **18. Universal Checkout Framework** 

18.1 One checkout framework is used across every Private Attaché product: Whitby, Academy, the Certified Private Attaché program, the Professional Practice Accelerator, the Specialty Endorsements, bundles, trials, and any future offering. 

18.2 Checkout displays the actual product, its price, its billing frequency or payment structure, the amount due, and any renewal or trial terms that apply. 

18.3 Prices and offerings displayed at checkout are dynamic and read from the underlying product and pricing configuration; they are never hard-coded directly into legal text. 

18.4 Checkout requires an unchecked acceptance checkbox before purchase can be completed, reading: “I agree to the Private Attaché Customer Terms and Refund & Cancellation Policy and acknowledge the Privacy Policy.” The checkbox must never be pre-checked by default. 

18.5 The system records, for every purchase: the customer’s identity, the product purchased, the price, the billing terms, a timestamp, the state of the acceptance checkbox, and the exact versions of the Customer Terms, the Refund Policy, and the Privacy Policy that were in effect at the moment of purchase. 

18.6 Historical acceptance records are preserved permanently; a later change to pricing or to the terms themselves must never overwrite or alter the record of an earlier transaction and what was accepted at that time. 

18.7 Marketing consent is captured as a separate, optional checkbox, distinct from the required legal-terms acceptance checkbox described in Section 18.4. 

18.8 A purchase may occur before the purchaser has created a full account; the completed transaction and acceptance record is attached to the account once that account is created. 

18.9 Short, conditional disclosures are used for recurring billing, trials, installments, or Academy digital-content refund rules, rather than requiring an entirely separate checkout agreement for each such scenario. 

18.10 The overarching goal of the checkout framework is to be able to prove, for any purchase, who bought what, at what price and under what terms, and exactly what they accepted at the time of that purchase. 

### **19. Legal Center** 

19.1 A Legal Center page is added to the website footer and serves as the home for every legal and policy document across the ecosystem. 

19.2 The Legal Center is organized into three sections. The General section contains the Terms of Use, the Privacy Policy, the Refund & Cancellation Policy, the Cookie & Tracking Technologies Policy, and the Accessibility Statement. The Data & Security section contains the Data Processing Addendum, the Subprocessor List, and the Security page. The Academy & Credentials section contains the Academy Policies and the Credential Policies. 

19.3 The website footer itself does not need to list every one of these documents individually; a footer reading “Terms | Privacy | Accessibility | Legal | Privacy Choices” is sufficient, with the “Legal” link opening the full Legal Center. 

19.4 The Legal Center is built so that documents and pages can be added, replaced, or versioned later without requiring the page itself to be redesigned. 

### **20. Cookie and Tracking Consent** 

20.1 The website, the Academy, the Client Portal, and Whitby are all built with a conservative cookie and tracking setup from the start. 

20.2 Cookies and tracking technologies are organized into four categories: Strictly Necessary, Functional, Analytics, and Marketing. 

20.3 The public-facing consent banner offers Accept All, Reject Non-Essential, and Manage Preferences; no non-essential cookie category is preselected or enabled by default. 

20.4 A persistent Cookie Settings or Privacy Choices link is available at all times so a user can change their consent preferences later. 

20.5 The consent-management platform supports the Global Privacy Control signal, maintains consent records, blocks non-essential tags prior to consent, integrates with the site’s tag manager, and supports withdrawal of previously given consent. 

20.6 No advertising or retargeting pixels are permitted inside any authenticated Whitby area or any authenticated Client Portal area. 

20.7 No advertising pixels are permitted anywhere near Academy assessment data, credential data, identity-verification data, appeal data, or score data. 

20.8 No tag, pixel, AI widget, analytics SDK, server-side tracking mechanism, or tag-manager configuration is permitted to bypass the user’s current consent state. 

20.9 Before any tracker is enabled, its URLs, events, and payloads are reviewed to confirm they do not expose names, email addresses, Request content, documents, health or identity data, credential data, AI prompts or outputs, or any other sensitive information. 

20.10 A basic cookie and vendor inventory is maintained, recording for each entry: the cookie or vendor name, the provider, the purpose, the category, the duration, whether consent is required, whether it is used in an authenticated area, and the date it was last reviewed. 

20.11 Before launch, the system is tested to confirm that selecting Reject actually blocks the relevant trackers, that withdrawing consent actually works, that the Global Privacy Control signal is honored where applicable, and that no marketing tracking exists anywhere in a sensitive or authenticated area. 

20.12 Consent is kept browser- and device-specific for this version; cross-device consent synchronization is not required. 

20.13 The governing rule is: reasonable analytics and marketing tracking is permitted on public pages, while much stricter tracking rules apply once a person enters Whitby, the Client Portal, or any Academy assessment or other sensitive area. 

### **21. Public Website — Main Navigation and Homepage** 

#### **21.1 Homepage Direction** 

21.1.1 The homepage keeps the broader Private Attaché story while making Whitby the primary thing a visitor experiences. 

21.1.2 The homepage’s opening hierarchy presents “Private Attaché™ — A new standard in professional coordination,” immediately followed by “Meet Whitby™ — The Intelligent Coordination Platform.” 

21.1.3 Whitby carries roughly sixty to seventy percent of the homepage, visually and narratively, showing the platform, Requests, Workplans, Relationships, the Client Portal, how the work flows, and how Whitby’s intelligence is embedded into the experience. 

21.1.4 The Academy remains part of the homepage but appears later in the story; the homepage must never feel like an education or certification company first. 

21.1.5 The overall narrative is: Private Attaché owns the category, Whitby makes it tangible, and the Academy develops the professional capability behind it. 

21.1.6 The visual direction combines the lightness of Attio, the storytelling approach of Front, and selectively darker or occasionally brighter areas representing Whitby’s intelligence layer, with restrained pops of color for character. 

21.1.7 KarbonHQ’s “Kai” feature is used as a reference for introducing AI naturally within the product story; Whitby is never presented as an “AI company,” and the site is never built entirely around AI as its central theme. 

21.1.8 The homepage uses familiar SaaS conventions so the product is easy to understand, without becoming a standard SaaS homepage where every section is simply another feature grid; the broader Private Attaché story keeps it feeling like a professional category and ecosystem rather than only software. 

21.1.9 A first-time visitor should understand Whitby quickly while also grasping the larger Private Attaché story: a new standard in professional coordination, with the Academy building the capability, credentials, and specialized expertise behind it. 

#### **21.2 Main Navigation Structure** 

21.2.1 The main website navigation is: Platform, Programs, Use Cases, Pricing, Log In, Get Started. 

21.2.2 Platform, Programs, and Use Cases each open a mega-menu; Pricing, Log In, and Get Started are direct links, with Get Started functioning as the primary call to action. 

#### **21.3 Platform Mega-Menu** 

21.3.1 The Platform mega-menu opens with “Meet Whitby™ — The Intelligent Coordination Platform,” subtitled “Run complex client work from request to follow-through in one intelligent operating system,” with a “Start Product Tour” call to action. 

21.3.2 A Coordinate section lists Requests, described as capturing what matters and turning it into clear next steps; Workplans, described as turning complex outcomes into a path everyone can follow; Tasks, described as keeping ownership, deadlines, and next actions easy to see; and Worksheets, described as working through details, comparisons, and decisions with greater clarity. 

21.3.3 An Organize section lists Relationships, described as keeping people, companies, preferences, and history close at hand; Knowledge, described as making useful information easy to find when it matters; Playbooks, described as reusing proven approaches without starting over every time; and Work History, described as seeing what happened, what changed, and what comes next. 

21.3.4 A Collaborate section lists Client Portal, described as giving clients one place to respond, approve, and stay informed; Messaging, described as keeping conversations connected to the work they belong to; Documents & Forms, described as collecting what is needed and keeping it with the work; and Integrations, described as connecting the tools already in use and reducing scattered information. 

#### **21.4 Programs Mega-Menu** 

21.4.1 The Programs mega-menu opens with “Private Attaché™ Academy — Professional Education for Intelligent Coordination,” subtitled “Advance how you work, deepen your expertise, and build a stronger professional practice,” with an “Explore the Academy” call to action. 

21.4.2 A Certification & Practice section lists Certified Private Attaché, described as earning the professional credential for accountable coordination; Professional Practice Pathway, described as combining certification with practical preparation to build a practice; Professional Practice Accelerator, described as turning experience into a credible, launch-ready professional practice; and Intelligent Coordination, offered free, described as using Whitby and AI to move complex work forward. 

21.4.3 A Specialty Endorsements section lists Principal Affairs, described as deepening capability around principals, priorities, and sensitive matters; Family Office Operations, described as navigating family, adviser, office, and decision complexity with confidence; Private Residence Operations, described as coordinating residences, providers, projects, and readiness around the client; and an “All Specialty Endorsements” link described as building deeper expertise in specialized areas of professional coordination. 

21.4.4 A For Organizations section lists Team Education, described as giving teams a stronger shared approach to complex work; Organizational Programs, described as building capability around an organization’s roles, needs, and priorities; Private Programs, described as creating focused education for a specific team or audience; and Enterprise Education, described as developing coordination capability across larger teams and organizations. 

#### **21.5 Use Cases Mega-Menu** 

21.5.1 The Use Cases mega-menu opens with “Intelligent Coordination, Applied to Real Work — Built for the People Who Make Complex Work Happen,” subtitled “See how intelligent coordination strengthens the work people already rely on you to deliver,” with an “Explore Use Cases” call to action. 

21.5.2 A Professionals & Practices section lists Executive & Principal Support, Independent Practices, Private Client Services, and Organizations & Teams, each with its own one-line description of how coordination strengthens that specific kind of work. 

21.5.3 A Private Operations section lists Family & Private Offices, Residence Operations, Personal & Family Operations, and Events & Experiences, each with its own one-line description. 

21.5.4 A Specialized Coordination section lists International Living, Healthcare Navigation, Private Aviation, and Collections & Private Assets, each with its own one-line description. 

#### **21.6 Pricing** 

21.6.1 Pricing is a direct main-navigation link with no dropdown, opening a page titled “Three Ways to Start.” 

21.6.2 The Whitby pricing card shows “The Intelligent Coordination Platform,” describes running complex professional work in one intelligent operating system, states a starting price, and includes a “View Platform Pricing” call to action. 

21.6.3 The Academy pricing card shows “Professional Education for Intelligent Coordination,” describes building capability, earning credentials, and deepening professional expertise, notes that free programs are available and that certification starts from a stated price, and includes a “View Program Pricing” call to action. 

21.6.4 The Organizations pricing card describes technology and professional education built around the visitor’s team, combining Whitby, Academy programs, or a tailored organizational approach, and includes a “Talk to Us” call to action. 

#### **21.7 Navigation Behavior** 

21.7.1 Platform, Programs, and Use Cases each display a dropdown indicator and open as a mega-menu on interaction. 

21.7.2 Pricing, Log In, and Get Started are direct links with no dropdown behavior; Get Started is styled as the primary call-to-action button in the navigation bar. 

### **22. Field and Data Model Guidance** 

22.1 The baseline structure and relationships defined throughout this specification give sufficient direction for normal product and data-model judgment to be applied; every record is expected to include the supporting fields needed to make it useful, searchable, enrichable, and connected across the platform, beyond only the fields explicitly named in this document. 

22.2 Contact and Company records include sensible enrichment and profile data where appropriate, such as websites, social or profile links, addresses, phone numbers, email addresses, roles or titles, organizations, locations, and source information, in addition to the fields explicitly called out elsewhere in this specification. 

22.3 Basic identity fields are preserved on every relevant person record, including salutation or title options such as Dr., Mr., Mrs., Ms., Sir, and Dame, along with preferred name and other normal contact information. 

22.4 This same principle of reasonable field completeness applies across Clients, Contacts, Companies, Providers, Requests, and every related record type: the fields documented in this specification form the operating baseline, and normal supporting fields are added wherever they are clearly necessary to make the records practical, searchable, enrichable, and connected. 

### **23. Design System Reference** 

23.1 One design system governs the visual presentation of every screen across all four modules and the public website; a screen is built by matching this system exactly rather than by introducing a new visual pattern specific to one module. 

23.2 The visual foundation uses a warm, near-black ink color for text rather than pure black, a warm off-white canvas background for the application, and white surfaces for cards, modals, and panels. 

23.3 Exactly one accent color is used across the entire product for primary buttons, links, and active navigation states; no module or screen introduces a second brand color. 

23.4 Thin, one-pixel borders are the default way containers, list rows, and cards are separated from one another; shadows are reserved only for a small number of genuinely elevated or floating surfaces, such as a dropdown or the hero product screenshot on the public website. 

23.5 A defined type scale governs every text size in the product, ranging from the marketing hero headline down through section headings, screen headings, card titles, body copy, form 

labels, and caption or meta text, so that heading and label sizing stays consistent across every module. 

23.6 A shared component library — buttons, form inputs, status pills, the application sidebar, numbered step rows, callout banners, module cards, chip-style multi-select controls, toggle switches, and avatars — is reused across every module rather than rebuilt independently by each one. 

23.7 Each of the four product modules carries its own accent-tinted icon color drawn from one shared palette: the professional platform, the Client Portal, the Academy, and the Partner Center each have a distinct icon tint, with the Academy’s learner-facing and course-authoring surfaces sharing one color since they are one module. No module introduces an icon color outside this shared set. 

23.8 The product switcher, described in Section 2.6, presents exactly four destinations corresponding to the four modules above; there is no fifth, generic destination in the switcher. 

23.9 Product copy and tone throughout the application are plain and operational, written for a private-client and concierge-services audience, and avoid generic SaaS marketing language; any statistic or numeric claim shown in the product or on the public website is concrete and specific rather than vague. 

### **24. Database and Shared Data Architecture** 

24.1 A shared base data layer holds every canonical, cross-module record type. Each module owns only the tables specific to its own function. No module ever re-creates a canonical record type as a local table of its own — this single rule is the most important architectural constraint in this specification, since violating it is what produces duplicate identities, drifting contact records, and orphaned documents across the ecosystem. 

24.2 The base layer holds: one identity record per person across the entire ecosystem, regardless of how many of the four products that person uses; workspaces, representing a professional’s tenant; workspace membership and role assignment; product entitlements, recording which of the four products a given identity may access; one generic invitation mechanism, reused for team invites, client member invites, and partner-application approvals rather than three separate invitation systems; canonical Contact records, reused across the professional platform and the Partner Center; canonical Company records, reused the same way; one shared Documents model, reused across the professional platform, the Client Portal, and the Partner Center, governed throughout by the Internal, Client Visible, and Restricted visibility levels defined in Section 9; a general audit log; and the configurable Category and Subcategory taxonomy described in Section 10. 

24.3 The professional platform’s own tables cover: Clients and client membership roles; Requests and Request participants; Workplans and their version history; Workstreams and Workstream dependencies; Tasks; Worksheets and Worksheet rows; Forms and Form submissions; Checklists; Playbooks; Providers and client-facing Provider options; Messages and Message participants; manually logged Communications; Calendar events; Notes; 

Considerations; Decisions; Risks; Updates; Timeline events; Knowledge articles; and integration connection records. 

24.4 The Client Portal’s own tables are deliberately minimal: an access-request table supporting the client-initiated, professional-approved People & Access workflow described in Sections 4.8 through 4.9, and a notification-preference table. Every other object the Client Portal displays — Requests, Documents, Forms, Messages, Updates, and Calendar — is the same underlying record the professional platform owns, presented through the permission layer described in Section 9 rather than duplicated into a second data store. 

24.5 The Academy and its course-authoring environment share one schema, since they are two surfaces on one catalog rather than two separate products. Their tables cover: Programs; Modules; Lessons; Quizzes and Questions; Enrollments; lesson-level progress; Credentials; instructor assignments; a publish-request table supporting the instructor publishing workflow described in Section 24.10; and training-workspace records linking a learner’s identity to a restricted professional-platform workspace. 

24.6 The Partner Center’s own tables cover: partner profiles, linked to the base canonical Company and Contact records rather than duplicating them; partner team members; program participation; commission rules; referral links and codes; Referrals; Enterprise Opportunities; attribution events; earnings; earning adjustments; payouts; and tax profiles. 

24.7 Every module table that references a person links back to the base identity record or the base Contact record; no module table ever stores its own duplicate identity or contact record. 

24.8 The partner commission rate defaults to the same percentage across the Academy, Platform, and Enterprise programs. Per-partner and per-program overrides remain fully available where the business later chooses to differentiate, but nothing in the underlying requirements mandates a different baseline rate per program, so a single default rate is used unless a specific partner’s terms say otherwise. 

24.9 The attribution window defaults to ninety days across every referral, with one documented exception: an accepted Enterprise Opportunity carries a protected attribution period of one hundred eighty days, per Section 17.6.9. No other variation is assumed without a specific instruction to that effect. 

24.10 The Academy instructor publishing workflow is: an instructor may create and edit content within the programs specifically assigned to them, but may not set a program live directly. The instructor submits the program for approval; once an administrator approves it, either the instructor or the administrator may complete the publish. This replaces any earlier assumption that an instructor could publish directly. 

### **25. Assumed Defaults — Resolved Pending Final Confirmation** 

Every item below was previously an open question. Each has now been assigned a working default so that design and development are not blocked; each remains clearly flagged as an assumption rather than a client-confirmed final decision, and should be revisited before launch. 

25.1 The final set of professional workspace roles is treated as: Owner, Admin, Team Lead, Coordinator, Billing, and Viewer. 

25.2 A Consideration is converted into a Task by way of a pre-filled Task creation flow, scoped to the relevant Workstream, opened directly from the Consideration’s own action button; the Consideration is then marked resolved and linked to the resulting Task. There is no bulk conversion of multiple Considerations at once in this version. 

25.3 Tasks, Forms, Worksheets, Decisions and Approvals, and Considerations are treated as structured native records. Checklists and Notes are treated as simple structured lists. Nothing in the Request or Workplan is freeform, aside from an attached Document itself. 

25.4 Every category and subcategory in the reference taxonomy is imported as provided; the review status recorded against each entry is not treated as a blocker to launch. 

25.5 The schema hooks that support future provider-sourcing and outreach automation are built now, per Section 12.3, but no automation logic itself ships in this version; sourcing and outreach remain fully manual. 

25.6 The partner commission rate defaults to fifteen percent across the Academy, Platform, and Enterprise programs, per Section 24.8. The attribution window defaults to ninety days across every referral type, except an accepted Enterprise Opportunity, which carries a one-hundredeighty-day protected attribution period, per Section 24.9. 

25.7 The default, commissionable Academy conversion event is a paid enrollment; a free enrollment is tracked for performance purposes but does not generate a commission by default. 

25.8 The period during which a newly referred partner customer is treated as a customer before commissions begin defaults to sixty days, as a working midpoint between the thirty-, sixty-, and ninety-day range described in the source material, pending the client’s final decision on the exact figure. 

25.9 The Academy instructor publishing boundary is resolved per Section 24.10: an instructor may create and edit content within their assigned programs, but publishing requires administrator approval first. 

25.10 Three Specialty Endorsements are named in the source material: Principal Affairs, Family Office Operations, and Private Residence Operations. Five additional placeholder names are used for wireframing purposes only, and are explicitly not client-confirmed: Estate & Legacy Operations, Health & Medical Coordination, Travel & Global Mobility, Security & Risk Management, and Household & Staffing Operations. 

25.11 Identity verification and proctoring gates are applied only to the Certified Private Attaché program’s final assessment by default. Specialty Endorsement programs use a lighter appliedwork review without formal proctoring unless a specific endorsement is later confirmed to require it. 

25.12 One consolidated payment-processing account is assumed at the base layer for the entire ecosystem. Every module reads entitlement and subscription status from that one account 

rather than integrating its own separate connection, and every purchase across every product flows through the one Universal Checkout Framework described in Section 18. 

25.13 Whitby may automatically draft anything classified as reversible internal work, per Section 12.1, without requiring a prior explicit user command, provided the result is clearly marked as a pending draft awaiting review. Anything client-visible or commitment-bearing continues to require explicit human initiation in every case. 

25.14 The ten documents already listed under the Legal Center in Section 19 are assumed sufficient for an initial, single-jurisdiction launch. No additional jurisdiction-specific policy pages are added by default. 

25.15 The specific consent-management platform vendor used to satisfy the cookie and tracking requirements in Section 20 remains unselected. The interface contract those requirements impose — four cookie categories, the specified banner behavior, and Global Privacy Control support — is fixed regardless of which vendor is ultimately chosen. 

