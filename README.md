# Project Launchpad (Azle)
This serves as a fundamental project launchpad that enables users to create, update, and view projects. It allows users to register their interest in a project by providing their email, facilitating future communication from the company to interested parties. Moreover, the launchpad features a countdown timer, ensuring that projects activate automatically when the specified time is reached.

## Functions
- createProject    : Create new project
- updateProject    : Update an existing project
- suspendProject   : Suspend an active project
- registerInterest : Allow user to register interest in the project
- countdownActive  : Set timer to auto activate the project
- removeCountDown  : Remove the timer
- getProjects      : Retrive all project
- getProjectById   : Retrive project by ID

## Deployment
Start the DFX in background

```dfx start --background```

Deploy the canister

```dfx deploy```