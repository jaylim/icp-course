import {
    Canister,
    Record,
    StableBTreeMap,
    Result,
    Duration,
    Vec,
    Void,
    TimerId,
    Variant,
    Ok,
    Err,
    Opt,
    query,
    text,
    int,
    bool,
    update,
    ic
} from 'azle';

const Project = Record({
    id: text,
    title: text,
    description: text,
    logo_url: text,
    is_active: bool,
    is_suspend: bool,
    interest_count: int,
    interest_email: Vec(text)
});

const ErrorVar = Variant({
    inactiveProjectId: text,
    suspendedProjectId: text,
    projectNotExist: text,
    invalidEmail: text,
    unauthorizedAction: text,
    reentrancyGuard: text
});

type ProjectType = typeof Project;

let projectStorage = StableBTreeMap(text, ProjectType, 0);

export default Canister({
    createProject: update([text, text, text, bool], text, (title, description, logo_url, is_active) => {
        let info: ProjectType = {
            id: uuidv4(),
            title,
            description,
            logo_url,
            is_active,
            is_suspend: false,
            interest_count: 0n,
            interest_email: []
        };
        projectStorage.insert(info.id, info);
        return info.id;
    }),

    updateProject: update([text, text, text, text, bool], text, (id, title, description, logo_url, is_active) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            throw new ErrorVar.projectNotExist(id);
        }

        let project: ProjectType = projectOpt.Some;

        if (project.is_suspend) {
            throw new ErrorVar.suspendedProjectId(id);
        }

        project.title = title;
        project.description = description;
        project.logo_url = logo_url;
        project.is_active = is_active;
        projectStorage.insert(project.id, project);
        return project.id;
    }),

    suspendProject: update([text], Void, (id) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            throw new ErrorVar.projectNotExist(id);
        }

        let project: ProjectType = projectOpt.Some;

        if (project.is_suspend) {
            throw new ErrorVar.suspendedProjectId(id);
        }

        // Implement access control here, e.g., check if the caller is authorized to suspend projects

        project.is_suspend = true;
        projectStorage.insert(project.id, project);
    }),

    registerInterest: update([text, text], Result(text, ErrorVar), (id, email) => {
        if (!isValidEmail(email)) {
            return Err({ invalidEmail: email });
        }

        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            return Err({ projectNotExist: id });
        }

        let project: ProjectType = projectOpt.Some;

        if (!project.is_active) {
            return Err({ inactiveProjectId: id });
        }

        if (project.is_suspend) {
            return Err({ suspendedProjectId: id });
        }

        // Implement reentrancy guard here

        project.interest_count++;
        project.interest_email.push(email);
        projectStorage.insert(project.id, project);

        return Ok("Interest registered successfully");
    }),

    countdownActive: update([text, Duration], TimerId, (id, delay) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            throw new ErrorVar.projectNotExist(id);
        }

        let project: ProjectType = projectOpt.Some;

        if (project.is_suspend) {
            throw new ErrorVar.suspendedProjectId(id);
        }

        // Implement access control here, e.g., check if the caller is authorized to activate projects

        const timerId = ic.setTimer(delay, () => {
            project.is_active = true;
            projectStorage.insert(project.id, project);
            console.log(`Project ${id} is activated`);
        });

        return timerId;
    }),

    removeCountDown: update([TimerId], Void, (timerId) => {
        ic.clearTimer(timerId);
        console.log(`Project timer ${timerId} cancelled`);
    }),

    getProjects: query([], Vec(ProjectType), () => {
        return projectStorage.values();
    }),

    getProjectById: query([text], Opt(ProjectType), (id) => {
        return projectStorage.get(id);
    }),
});

function isValidEmail(email: string): boolean {
    // Implement email validation logic here
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
