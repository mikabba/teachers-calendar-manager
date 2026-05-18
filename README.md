# Teachers Calendar Manager

A web-based scheduling and room management application developed to support the operational workflow of a music school.

The tool helps coordinate teacher schedules, room availability, ordinary lessons, recovery lessons and daily calendar views through a simple interface designed for non-technical users.

## Live Demo

[Open the deployed application](https://www.accademiamusicalegirolamoscarasciullo.com/CalendarioDocenti/calendariodocenti.html)

## Problem

Music schools often need to coordinate multiple teachers, rooms, lesson durations and recovery lessons within a weekly schedule.

This creates practical scheduling constraints such as:

- avoiding overlapping bookings;
- checking room availability;
- handling ordinary and recovery lessons;
- supporting teacher-specific calendar views;
- exporting daily schedules for operational use.

## Solution

Teachers Calendar Manager provides a lightweight web interface for managing scheduling workflows in a music school context.

The application focuses on usability, clarity and practical workflow support rather than unnecessary complexity.

## Main Features

- Teacher login
- Admin and teacher roles
- Weekly calendar view
- Daily calendar view
- Room-based availability management
- Ordinary lesson scheduling
- Recovery lesson scheduling
- Teacher-specific workflows
- User management
- Password change and reset flow
- PDF export
- Overlap prevention for conflicting bookings

## Screenshots

### Login

![Login](assets/teachers-calendar-login.png)

### Weekly View

![Weekly View](assets/teachers-calendar-weekly-view.png)

### PDF Export

![PDF Export](assets/teachers-pdf-export.png)

## Technical Overview

The application follows a lightweight full-stack architecture:

| Layer | Technologies | Responsibility |
|---|---|---|
| Frontend | HTML, CSS, JavaScript, jQuery | User interface, calendar rendering, modals, AJAX interactions |
| Backend | PHP | Authentication, authorization, scheduling endpoints, persistence logic |
| Storage | Private PHP array files | File-based storage for users, ordinary lessons and recovery lessons |
| PDF Export | jsPDF, jsPDF-AutoTable | Daily calendar export for operational use |

The application is intentionally simple and self-contained, making it easy to deploy on a standard PHP-based hosting environment without requiring a full database server.


## System Architecture

```text
User Interface
    |
    | AJAX requests
    v
PHP Endpoints
    |
    | authentication, validation, scheduling rules
    v
Private Storage
    |
    | users.php / database.php
    v
Calendar Data
```

The backend separates authentication logic, user management, ordinary lesson scheduling, recovery lesson scheduling and PDF-oriented data loading into dedicated endpoints.


## Scheduling Logic

The application separates:

- ordinary weekly lessons;
- date-specific recovery lessons.

Before saving a lesson, the backend checks whether the selected room or teacher is already occupied in the requested time interval.

## Security and Privacy Notes

This public repository does not include real private data.

## Portfolio Relevance

This project demonstrates my ability to build deployed software tools for real users.

It complements my engineering portfolio by showing:

- practical software design;
- workflow-oriented thinking;
- user-facing web application development;
- scheduling and constraint handling;
- role-based access;
- deployment of a working tool in a real context;
- documentation of a real-world software project.

## Next Steps

- Add setup instructions
- Add a sanitized demo dataset
- Add system architecture diagram
- Improve technical documentation
- Add screenshots for mobile and admin views
