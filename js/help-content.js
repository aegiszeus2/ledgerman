// Ledgerman — Module Help Content
// Each key matches the navigation route string in app.js
// Used by the "? How To" button injected after every navigate()

window.LedgermanHelp = {

    // ── ADMIN MODULES ─────────────────────────────────────────────────────────

    dashboard: {
        title: 'Dashboard',
        intro: 'Your command centre — real-time snapshot of open work, pending approvals, and outstanding invoices.',
        steps: [
            'Review the summary cards at the top for active jobs, pending approvals, and overdue invoices.',
            'Click any card to jump directly to that module.',
            'The Recent Activity feed shows the last actions taken across the company.',
            'Use the top navigation bar to switch between modules at any time.'
        ]
    },

    projects: {
        title: 'Projects',
        intro: 'Track all your construction projects from start to finish.',
        steps: [
            'Click "+ New Project" to create a project — enter the name, client, start date, and budget.',
            'Click any project row to open the project detail view.',
            'In the detail view, you can log time, add expenses, view photos, and track tasks.',
            'Change project status (Active / On Hold / Complete) from the detail view.',
            'Budget variance is calculated automatically once expenses are logged.'
        ]
    },

    'project-detail': {
        title: 'Project Detail',
        intro: 'Full view of a single project — time, expenses, tasks, and photos in one place.',
        steps: [
            'The summary bar shows total hours, expenses, and budget variance at a glance.',
            'Use the tabs to switch between Time Entries, Expenses, Tasks, and Photos.',
            'Click "Edit Project" to update the name, client, budget, or status.',
            'Change the project status (Active / On Hold / Complete) using the status dropdown.',
            'All approved time and expenses linked to this project are shown here.',
            'Use the back arrow to return to the Projects list.'
        ]
    },

    'task-assignment': {
        title: 'Task Assignment',
        intro: 'Create and assign tasks to workers on specific projects.',
        steps: [
            'Click "+ New Task" to create a task.',
            'Fill in the task title, assign it to a worker, select the project, and set a due date.',
            'Set the initial status: To Do, In Progress, or Done.',
            'Use the filters at the top to view tasks by status, project, or assigned worker.',
            'Click Edit on any task to update it. Overdue tasks are highlighted automatically.',
            'Workers see their assigned tasks in the Worker Portal under "My Tasks".'
        ]
    },

    'budget-tracking': {
        title: 'Budget Tracking',
        intro: 'Monitor project budgets against actual spending in real time.',
        steps: [
            'Select a project from the dropdown to load its budget summary.',
            'The variance column shows how much is left (green) or overspent (red) per category.',
            'Expenses logged by workers flow in automatically — no manual entry needed here.',
            'Click Refresh to pull the latest data.',
            'Use the Reports module for exportable budget summaries.'
        ]
    },

    'daily-reports': {
        title: 'Supervisor Reports',
        intro: 'Review daily site summaries submitted by your workers.',
        steps: [
            'Reports appear here once workers submit them from the Worker Portal.',
            'Each report includes crew count, hours worked, equipment, weather, and any issues.',
            'Click "Review" on any report to open the full detail view.',
            'Mark reports as Reviewed or Approved using the buttons in the detail view.',
            'Filter reports by status or project using the dropdowns at the top.',
            'Reports are sorted newest first by default.'
        ]
    },

    'punch-lists': {
        title: 'Punch Lists & Deficiencies',
        intro: 'Track project deficiencies from identification through to sign-off.',
        steps: [
            'Click "+ Add Deficiency" to log a new punch list item.',
            'Select the project, describe the issue, and set the priority (Low / Medium / High / Critical).',
            'Status workflow: Open → In Progress → Resolved → Signed Off.',
            'Edit any item to update its status as work progresses.',
            'Filter by project or status to focus on open items.',
            'Items sorted by priority by default — Critical issues appear first.'
        ]
    },

    'gantt-chart': {
        title: 'Project Timeline (Gantt)',
        intro: 'Visualize your project schedule and task timelines.',
        steps: [
            'Select a project from the dropdown to load its task timeline.',
            'Tasks appear as bars — bar length is the duration from start date to due date.',
            'Tasks without a start or due date default to a 7-day bar from today.',
            'Set start dates and due dates in Task Assignment to get accurate bars.',
            'Use Task Assignment to add, edit, or reassign tasks.'
        ]
    },

    approvals: {
        title: 'Approvals',
        intro: 'Review and approve time entries submitted by workers.',
        steps: [
            'Pending submissions appear here once workers submit their time.',
            'Click a submission row to expand the details — hours, project, notes, expenses, and any site photos.',
            'Click "Approve" to accept the submission. It will be included in reports and invoices.',
            'Click "Reject" to send it back to the worker with a reason.',
            'Approved time flows into the Reports and Invoices modules automatically.',
            'Switch between Pending, Approved, and Rejected tabs to review all submissions.'
        ]
    },

    invoices: {
        title: 'Invoices',
        intro: 'Create and track client invoices for completed work.',
        steps: [
            'Before creating an invoice, make sure the project has expenses logged — invoices are built from billable expenses.',
            'Click "+ Create Invoice" to launch the invoice wizard — only projects with uninvoiced billable expenses will appear.',
            'Work through the wizard: select project, choose expenses, set billing period, review totals, and save.',
            'HST and holdback are calculated automatically based on your company settings.',
            'Set the invoice status: Draft → Sent → Paid.',
            'Record payments against an invoice using the "Record Payment" button — the outstanding balance updates automatically.'
        ]
    },

    'invoice-detail': {
        title: 'Invoice Detail',
        intro: 'Full view of a single invoice — line items, payments, and status.',
        steps: [
            'The header shows the invoice number, client, project, and current status.',
            'Line items are listed below — each shows description, quantity, rate, and amount.',
            'The totals section shows subtotal, HST, holdback (if applicable), and amount due.',
            'Click "Add Payment" to record a payment — the outstanding balance updates automatically.',
            'Click "Send" to mark the invoice as sent to the client.',
            'Use the Print button to generate a PDF-ready invoice.'
        ]
    },

    'invoice-create': {
        title: 'Create Invoice',
        intro: 'Build a new invoice from billable expenses logged against a project.',
        steps: [
            'Invoices are generated from expenses — log expenses against a project first (Expenses module).',
            'Select the project — only projects with uninvoiced billable expenses appear in the list.',
            'Choose which expenses to include as line items on this invoice.',
            'Set the billing period, invoice date, payment terms, and notes.',
            'HST and holdback rates default to your company settings — adjust per invoice if needed.',
            'Review the totals, then save as Draft or mark as Sent.'
        ]
    },

    estimates: {
        title: 'Bid Estimates',
        intro: 'Prepare and manage project estimates for clients.',
        steps: [
            'Click "+ New Estimate" to start — enter the client name and description.',
            'Add line items (labour, materials) with quantities and unit prices.',
            'Add direct costs (equipment, subcontractors) separately from line items.',
            'The subtotal, tax, and grand total calculate automatically.',
            'Change status: Draft → Sent → Approved.',
            'An approved estimate can be converted into a project using "Create Project".'
        ]
    },

    'estimate-detail': {
        title: 'Estimate Detail',
        intro: 'Full view of a bid estimate — line items, costs, and status.',
        steps: [
            'The header shows the estimate number, client, and current status (Draft / Sent / Approved).',
            'Line items show labour and materials broken down by quantity and unit price.',
            'Direct costs (equipment, subcontractors) are listed separately below.',
            'Totals calculate automatically — subtotal, HST, and grand total.',
            'Click "Send" to mark it as sent to the client.',
            'Once approved, click "Create Project" to convert the estimate into an active project.'
        ]
    },

    clients: {
        title: 'Clients',
        intro: 'Your client address book.',
        steps: [
            'Click "+ Add Client" to add a new client with contact info.',
            'Click any client to view or edit their details.',
            'Clients are linked to projects and invoices — set the client when creating a project.',
            'Deleting a client does not delete their linked projects.'
        ]
    },

    vendors: {
        title: 'Vendors',
        intro: 'Manage your suppliers and subcontractors.',
        steps: [
            'Click "+ Add Vendor" to add a new vendor — name, trade, and contact info.',
            'Click any vendor to view details or log notes.',
            'Vendors can be attached to expenses when workers log field costs.',
            'Use the search bar to find vendors quickly.'
        ]
    },

    'vendor-detail': {
        title: 'Vendor Detail',
        intro: 'Full profile for a single vendor — contact info, trade, and notes.',
        steps: [
            'Review the vendor\'s trade, phone, email, and address at the top.',
            'Use the Notes section to log any relevant information about this vendor.',
            'Click "Edit" to update the vendor\'s details.',
            'Any expenses linked to this vendor are listed in the Expenses tab.',
            'Use the back arrow to return to the Vendors list.'
        ]
    },

    expenses: {
        title: 'Expenses',
        intro: 'Track project expenses submitted in the field.',
        steps: [
            'Expenses logged by workers appear here automatically.',
            'Click "+ Add Expense" to log an expense manually as an admin.',
            'Each expense has a project, category, amount, and optional receipt photo.',
            'Approved expenses feed into budget tracking and reports.',
            'Expenses pending review appear in Expenses Review with approve/reject actions.'
        ]
    },

    'expenses-review': {
        title: 'Expenses Review',
        intro: 'Review worker-submitted expenses and classify them as billable or non-billable.',
        steps: [
            'Use the filters at the top to narrow by project, category, vendor, or billable status.',
            'Select one or more expenses using the checkboxes on the left.',
            'Click "Mark Billable" to flag selected expenses for invoicing, or "Mark Non-Billable" to exclude them.',
            'Billable expenses flow into the invoice creation wizard automatically.',
            'Click any expense row to view the full detail including receipt photo if attached.'
        ]
    },

    users: {
        title: 'Workers',
        intro: 'Manage your field crew accounts and PINs.',
        steps: [
            'Click "+ Add Worker" to create a new worker account.',
            'Set the worker\'s name, role, and a 4–6 digit PIN for field login.',
            'Workers log in from the Worker Portal using the company name, their name, and PIN — no email needed.',
            'Deactivate a worker to block their login without deleting their history.',
            'Use "Send Invite" to invite workers who need email-based accounts.'
        ]
    },

    photos: {
        title: 'Photo Gallery',
        intro: 'Browse all job site photos organized by project.',
        steps: [
            'Photos appear here after workers upload them during time entry.',
            'Use the project filter to view photos for a specific job.',
            'Click any photo to open the full-size view.',
            'Use "Export" to download all photos for a project to your computer.',
            'Photos are stored securely — only your company can see them.'
        ]
    },

    reports: {
        title: 'Reports',
        intro: 'Summarized cost, labour, and invoice reports across all projects.',
        steps: [
            'Select a report type from the tabs: Labour, Expenses, or Invoices.',
            'Filter by project or date range to narrow the results.',
            'The totals row summarizes all visible data.',
            'Use your browser\'s Print function (Ctrl+P) to print or save as PDF.'
        ]
    },

    settings: {
        title: 'Settings',
        intro: 'Configure your company profile, billing, and system preferences.',
        steps: [
            'Update your company name, address, and HST number in Company Info.',
            'Upload your company logo — it appears on invoices.',
            'Set your default HST rate under Invoice Settings.',
            'Change your admin password under Security.',
            'Use Backup & Restore to export or import all company data.'
        ]
    },

    // ── WORKER MODULES ────────────────────────────────────────────────────────

    home: {
        title: 'Worker Home',
        intro: 'Your starting point — active projects and quick actions.',
        steps: [
            'Tap a project to go directly to time entry for that job.',
            'If a submission was rejected, a banner will appear at the top — tap it to resubmit.',
            'Use the bottom navigation to switch between Home, Log Time, History, and Tasks.',
            'Tap the clock icon to log time on any project.'
        ]
    },

    timeentry: {
        title: 'Log Time',
        intro: 'Submit your hours worked for the day.',
        steps: [
            'Select the project you worked on from the dropdown.',
            'Enter the date and your hours worked.',
            'Add any expenses (materials, fuel, equipment) using the Add Expense button.',
            'Attach site photos using the camera icon — photos are linked to this submission.',
            'Tap Submit when done. Your entry goes to your supervisor for approval.',
            'You can log multiple entries per day for different projects.'
        ]
    },

    history: {
        title: 'My History',
        intro: 'View all your past time entries and their status.',
        steps: [
            'Approved entries are shown in green — hours and project are visible on each card.',
            'Rejected entries show in red with the rejection reason — tap "Resubmit" to correct and resend.',
            'Pending entries are waiting for your supervisor\'s review.',
            'Use the filter tabs (All / Pending / Approved / Rejected) to sort your history.'
        ]
    },

    tasks: {
        title: 'My Tasks',
        intro: 'View and update tasks assigned to you.',
        steps: [
            'Tasks assigned to you by your supervisor appear here.',
            'Tap "Start Task" to change a task from To Do to In Progress.',
            'Tap "Mark Complete" when the work is done.',
            'Overdue tasks are highlighted in red.',
            'Tap any task card to see the full description and project details.'
        ]
    }
};

// Utility: show help modal for a given route
Utils.showHelpModal = function(route) {
    const help = window.LedgermanHelp[route];
    if (!help) {
        Utils.showToast('No guide available for this page yet.', 'info');
        return;
    }

    // Remove any existing help modal
    const existing = document.getElementById('helpModalOverlay');
    if (existing) existing.remove();

    const stepsHtml = help.steps.map((step, i) => `
        <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb">
            <div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--primary,#0066cc);color:#fff;
                        display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700">${i + 1}</div>
            <div style="padding-top:3px;color:#111111;font-size:.95rem;line-height:1.5">${step}</div>
        </div>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'helpModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
        <div style="background:#ffffff;border-radius:12px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)">
            <div style="padding:20px 20px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                    <div style="font-size:.75rem;font-weight:700;color:#1a3a5c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">How To Use</div>
                    <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:#111111">${help.title}</h3>
                    <p style="margin:6px 0 0;font-size:.9rem;color:#333333">${help.intro}</p>
                </div>
                <button id="helpModalClose" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#333333;padding:0 0 0 12px;line-height:1">×</button>
            </div>
            <div style="padding:8px 20px 20px">
                ${stepsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#helpModalClose').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
};
