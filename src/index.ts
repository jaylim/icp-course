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
import { v4 as uuidv4 } from 'uuid';

const Project = Record({
    id          : text,
    title       : text,
    description : text,
    logo_url    : text,
    is_active   : bool,
    is_suspend  : bool,
    interest_count : int,
    interest_email : Vec(text)
});

const ErrorVar = Variant({
    inactiveProjectId  : text,
    suspendedProjectId : text,
    projectNotExist    : text
});

type Project = typeof Project;

let projectStorage = StableBTreeMap(text, Project, 0);

export default Canister({
    // create a new project
    createProject: update([text, text, text, bool], text, (title, description, logo_url, is_active) => {
        let info: Project = {
            id             : uuidv4(),
            title          : title,
            description    : description,
            logo_url       : logo_url,
            is_active      : is_active,
            is_suspend     : false,
            interest_count : 0n,
            interest_email : []
        };
        projectStorage.insert(info.id, info);
        return info.id;
    }),

    // update an existing active project
    updateProject: update([text, text, text, text, bool], text, (id, title, description, logo_url, is_active) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            throw new Error("Project not exist");
        }

        let project: Project = projectOpt.Some;

        if (project.is_suspend) {
            throw new Error("project suspended");
        }

        project.title       = title;
        project.description = description;
        project.logo_url    = logo_url;
        project.is_active   = is_active;
        projectStorage.insert(project.id, project);
        return project.id;
    }),

    // suspend project (non-revertable)
    suspendProject: update([text], Void, (id) => {
        let projectOpt = projectStorage.get(id);

        if('None' in projectOpt){
            throw new Error("project not exist");
        }

        let project: Project = projectOpt.Some;

        if (project.is_suspend) {
            throw new Error("project suspended");
        }

        project.is_suspend = true;
        projectStorage.insert(project.id, project);
    }),

    // allow user to register interest in the project
    registerInterest: update([text, text], Result(text, ErrorVar), (id, email) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            return Err({
                projectNotExist: id
            });
        }

        let project: Project = projectOpt.Some;

        if (!project.is_active) {
            return Err({
                inactiveProjectId: id
            });
        }

        if (project.is_suspend) {
            return Err({
                suspendedProjectId: id
            });
        }

        project.interest_count++;
        project.interest_email.push(email);
        projectStorage.insert(project.id, project);

        return Ok("Interest registered successfully");
    }),

    // set timer to auto activate the project
    countdownActive: update([text, Duration], TimerId, (id, delay) => {
        let projectOpt = projectStorage.get(id);

        if ('None' in projectOpt) {
            throw new Error("Project not exist");
        }

        let project: Project = projectOpt.Some;

        if (project.is_suspend) {
            throw new Error("project is suspend");
        }

        const timerId = ic.setTimer(delay, () => {
            project.is_active = true;
            projectStorage.insert(project.id, project);
            console.log(`project ${id} is activated`);
        });

        return timerId;
    }),

    // remove timer
    removeCountDown: update([TimerId], Void, (timerId) => {
        ic.clearTimer(timerId);
        console.log(`project timer cancelled`);
    }),

    // retrieve all project
    getProjects: query([], Vec(Project), () => {
        return projectStorage.values();
    }),

    // retrieve project by id
    getProjectById: query([text], Opt(Project), (id) => {
        return projectStorage.get(id);
    }),
})