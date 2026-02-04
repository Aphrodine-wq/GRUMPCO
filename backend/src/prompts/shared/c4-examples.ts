// C4 Model Mermaid Syntax Examples
// Reference: https://mermaid.js.org/syntax/c4.html

export const C4_SYSTEM_CONTEXT_EXAMPLE = `
C4Context
    title System Context diagram for Internet Banking System
    
    Enterprise_Boundary(b0, "Bank") {
        Person(customer, "Banking Customer", "A customer of the bank")
        System(banking_system, "Internet Banking System", "Allows customers to view account info and make payments")
    }
    
    System_Ext(mail_system, "E-mail System", "Microsoft Exchange")
    System_Ext(mainframe, "Mainframe Banking System", "Stores account info")
    
    Rel(customer, banking_system, "Uses")
    Rel(banking_system, mail_system, "Sends e-mails using")
    Rel(banking_system, mainframe, "Gets account info from")
`;

export const C4_CONTAINER_EXAMPLE = `
C4Container
    title Container diagram for Internet Banking System
    
    Person(customer, "Banking Customer", "A customer of the bank")
    
    Container_Boundary(c1, "Internet Banking System") {
        Container(web_app, "Web Application", "JavaScript, React", "Delivers the static content and SPA")
        Container(api, "API Application", "Node.js, Express", "Provides banking functionality via API")
        ContainerDb(db, "Database", "PostgreSQL", "Stores user info, transactions")
        Container(cache, "Cache", "Redis", "Caches session data")
    }
    
    System_Ext(mainframe, "Mainframe Banking System", "Stores core banking data")
    
    Rel(customer, web_app, "Uses", "HTTPS")
    Rel(web_app, api, "Makes API calls to", "JSON/HTTPS")
    Rel(api, db, "Reads/writes to", "SQL")
    Rel(api, cache, "Caches data in")
    Rel(api, mainframe, "Gets account data from", "XML/HTTPS")
`;

export const C4_COMPONENT_EXAMPLE = `
C4Component
    title Component diagram for API Application
    
    Container_Boundary(api, "API Application") {
        Component(auth, "Auth Controller", "Express Router", "Handles authentication")
        Component(accounts, "Accounts Controller", "Express Router", "Provides account operations")
        Component(payments, "Payments Controller", "Express Router", "Handles payment processing")
        Component(auth_service, "Auth Service", "TypeScript Class", "Validates credentials")
        Component(account_service, "Account Service", "TypeScript Class", "Business logic for accounts")
        ComponentDb(repo, "Repository", "Prisma Client", "Data access layer")
    }
    
    ContainerDb_Ext(db, "Database", "PostgreSQL")
    System_Ext(mainframe, "Mainframe", "Core banking")
    
    Rel(auth, auth_service, "Uses")
    Rel(accounts, account_service, "Uses")
    Rel(auth_service, repo, "Uses")
    Rel(account_service, repo, "Uses")
    Rel(account_service, mainframe, "Fetches data from")
    Rel(repo, db, "Reads/writes")
`;

export const C4_DYNAMIC_EXAMPLE = `
C4Dynamic
    title Dynamic diagram for User Login Flow
    
    ContainerDb(db, "Database", "PostgreSQL")
    Container(api, "API Server", "Node.js")
    Container(web, "Web App", "React SPA")
    Person(user, "User")
    
    Rel(user, web, "1. Enters credentials")
    Rel(web, api, "2. POST /auth/login")
    Rel(api, db, "3. Validate user")
    Rel(db, api, "4. Return user data")
    Rel(api, web, "5. Return JWT token")
    Rel(web, user, "6. Show dashboard")
`;

export const C4_LEVEL_DESCRIPTIONS = {
  context:
    "System Context: Shows the system in scope and its relationships with external users and systems. Big picture view.",
  container:
    "Container: Zooms into the system to show the high-level technical building blocks (applications, data stores, microservices).",
  component:
    "Component: Zooms into an individual container to show its internal components and their relationships.",
  code: "Code: Optional level showing class diagrams, ER diagrams, or other code-level details within a component.",
} as const;

export const C4_SYNTAX_GUIDE = `
## C4 Diagram Syntax Reference

### Diagram Types
- C4Context - System context level
- C4Container - Container level  
- C4Component - Component level
- C4Dynamic - Dynamic/sequence view

### Elements
- Person(alias, "Label", "Description")
- System(alias, "Label", "Description")
- System_Ext(alias, "Label", "Description") - External system
- Container(alias, "Label", "Technology", "Description")
- ContainerDb(alias, "Label", "Technology", "Description") - Database
- Container_Ext(alias, "Label", "Technology", "Description")
- Component(alias, "Label", "Technology", "Description")
- ComponentDb(alias, "Label", "Technology", "Description")

### Boundaries
- Enterprise_Boundary(alias, "Label") { ... }
- System_Boundary(alias, "Label") { ... }
- Container_Boundary(alias, "Label") { ... }

### Relationships
- Rel(from, to, "Label")
- Rel(from, to, "Label", "Technology")
- BiRel(from, to, "Label") - Bidirectional
`;

export type C4Level = "context" | "container" | "component" | "code";
