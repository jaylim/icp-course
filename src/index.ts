import {
    Record,
    StableBTreeMap,
    Result,
    Vec,
    TimerId,
    Variant,
    $query,
    int,
    $update,
    ic,
    nat64,
    Opt,
    match,
    Duration
} from 'azle';

import { v4 as uuidv4 } from 'uuid';

// Define the structure for a project
type ProjectType = Record<{
    id: string,
    title: string,
    description: string,
    logo_url: string,
    is_active: boolean,
    is_suspend: boolean,
    interest_count: int,
    interest_email: Vec<string>,
    createdAt: nat64,
    updatedAt: Opt<nat64>,
}>;

// Define the payload for creating or updating a project
type ProjectPayload = Record<{
    title: string;
    description: string;
    logo_url: string;
    is_active: boolean;
}>;

// Define error variants for different error scenarios
type ErrorVar = Variant<{
    inactiveProjectId: string,
    suspendedProjectId: string,
    projectNotExist: string,
    invalidEmail: string,
    unauthorizedAction: string,
    reentrancyGuard: string
}>;

// Initialize a stable BTree map to store projects
const projectStorage = new StableBTreeMap<string, ProjectType>(0, 44, 1024);

$update
// Function to create a new project
export function createProject(payload: ProjectPayload): Result<ProjectType, ErrorVar> {
    try {
        // Validate payload properties
        if (!payload.title || !payload.description || !payload.logo_url || typeof payload.is_active !== 'boolean') {
            throw new Error("Invalid payload");
        }

        // Generate a new UUID for the project
        const id = uuidv4();
        // Create a new project with the provided payload and default values
        const info: ProjectType = {
            id,
            title: payload.title,
            description: payload.description,
            logo_url: payload.logo_url,
            is_active: payload.is_active,
            is_suspend: false,
            interest_count: 0n,
            interest_email: [],
            createdAt: ic.time(),
            updatedAt: Opt.None
        };

        // Insert the new project into the storage
        projectStorage.insert(info.id, info);

        // Return the project as a success result
        return Result.Ok<ProjectType, ErrorVar>(info);
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<ProjectType, ErrorVar>({ reentrancyGuard: `Error creating project: ${error}` });
    }
}

$update
// Function to update an existing project
export function updateProject(id: string, payload: ProjectPayload): Result<ProjectType, string> {
    try {
         // Validate email
         if (!id) {
            return Result.Err("invalid Id Parameter");
        }
       
        // Validate payload properties
        if (!payload.title || !payload.description || !payload.logo_url || typeof payload.is_active !== 'boolean') {
            throw new Error("Invalid payload");
        }

        // Use match to handle the existence of the project with the provided ID
        return match(projectStorage.get(id), {
            Some: (project) => {
                // Check if the project is suspended
                if (project.is_suspend === true) {
                    return Result.Err<ProjectType, string>("project with id is suspended");
                }

                // Create an updated project with the provided payload
                const updatedProject: ProjectType = {
                    ...project,
                    title: payload.title,
                    description: payload.description,
                    logo_url: payload.logo_url,
                    is_active: payload.is_active,
                    updatedAt: Opt.Some(ic.time())
                };

                // Update the project in the storage
                projectStorage.insert(updatedProject.id, updatedProject);

                // Return the updated project as a success result
                return Result.Ok<ProjectType, string>(updatedProject);
            },
            None: () => Result.Err<ProjectType, string>("project with id does not exist "),
        });
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<ProjectType, string>(`Error updating project: ${error}`);
    }
}

$update
// Function to suspend an existing project
export function suspendProject(id: string): Result<ProjectType, string> {
    try {
         // Validate email
         if (!id) {
            return Result.Err("invalid Id Parameter");
        }
       
        // Use match to handle the existence of the project with the provided ID
        return match(projectStorage.get(id), {
            Some: (project) => {
                // Check if the project is already suspended
                if (project.is_suspend) {
                    return Result.Err<ProjectType, string>("suspendedProjectId");
                }

                // Implement access control here if needed

                // Suspend the project
                project.is_suspend = true;
                projectStorage.insert(project.id, project);

                // Return the suspended project as a success result
                return Result.Ok<ProjectType, string>(project);
            },
            None: () => Result.Err<ProjectType, string>("projectNotExist(id)"),
        });
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<ProjectType, string>(`Error suspending project: ${error}`);
    }
}

$update
// Function to register interest in a project
export function registerInterest(id: string, email: string): Result<string, string> {
    try {
        // Validate email
        if (!id) {
            return Result.Err("invalid Id Parameter");
        }
        // Validate email
        if (!isValidEmail(email)) {
            return Result.Err("invalidEmail");
        }

        // Use match to handle the existence of the project with the provided ID
        return match(projectStorage.get(id), {
            Some: (project) => {
                // Check if the project is not active
                if (!project.is_active) {
                    return Result.Err<string, string>("inactive Project with Id");
                }

                // Check if the project is suspended
                if (project.is_suspend) {
                    return Result.Err<string, string>("suspendedProjectId");
                }

                // Implement reentrancy guard here

                // Increment interest count and add email to the list
                project.interest_count++;
                project.interest_email.push(email);
                projectStorage.insert(project.id, project);

                // Return success message
                return Result.Ok<string, string>("Interest registered successfully");
            },
            None: () => Result.Err<string, string>("projectNotExist"),
        });
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<string, string>(`Error registering interest: ${error}`);
    }
}

$update
// Function to start a countdown timer for activating a project
export function countdownActive(id: string, delay: Duration): Result<TimerId, string> {
    try {
        // Use match to handle the existence of the project with the provided ID
        return match(projectStorage.get(id), {
            Some: (project) => {
                // Check if the project is suspended
                if (project.is_suspend) {
                    return Result.Err<TimerId, string>("suspendedProjectId");
                }

                // Implement access control here if needed

                // Set a timer to activate the project after the specified delay
                const timerId = ic.setTimer(delay, () => {
                    project.is_active = true;
                    projectStorage.insert(project.id, project);
                    console.log(`Project ${id} is activated`);
                });

                // Return the timerId as a success result
                return Result.Ok<TimerId, string>(timerId);
            },
            None: () => Result.Err<TimerId, string>("projectNotExist"),
        });
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<TimerId, string>(`Error starting countdown: ${error}`);
    }
}

$query
// Function to get all projects
export function getProjects(): Result<Vec<ProjectType>, string> {
    try {
        // Return all projects as a success result
        return Result.Ok(projectStorage.values());
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<Vec<ProjectType>, string>(`Error getting projects: ${error}`);
    }
}

$query
// Function to get a project by ID
export function getProjectById(id: string): Result<ProjectType, string> {
    try {
        // Use match to handle the existence of the project with the provided ID
        return match(projectStorage.get(id), {
            Some: (project) => Result.Ok<ProjectType, string>(project),
            None: () => Result.Err<ProjectType, string>(`Project with ID=${id} not found.`),
        });
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<ProjectType, string>(`Error getting project by ID: ${error}`);
    }
}

$update
// Function to remove a countdown timer
export function removeCountDown(timerId: TimerId): Result<string, string> {
    try {
        // Clear the timer with the specified timerId
        ic.clearTimer(timerId);
        console.log(`Project timer ${timerId} cancelled`);

        // Return success message
        return Result.Ok("removeCountDown ");
    } catch (error: any) {
        // Handle errors and return an appropriate error result
        return Result.Err<string, string>(`Error removing countdown: ${error}`);
    }
}

// Function to validate an email address
function isValidEmail(email: string): boolean {
    // Implement email validation logic here
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Define the global crypto object for generating random values
globalThis.crypto = {
    //@ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};
