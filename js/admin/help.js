// Admin Help & Documentation Module
window.AdminHelp = {
    _activeSection: null,
    _searchTerm: '',

    _sections: [
        {
            id: 'getting-started',
            title: 'Getting Started',
            icon: '&#9889;',
            content:
                '<h4>Welcome to LedgerMan</h4>' +
                '<p>This application helps you manage construction projects, track worker time, handle expenses, generate compliant invoices, and maintain financial records &mdash; all from one place.</p>' +

                '<h4 style="margin-top:16px">First-Time Setup</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:8px"><strong>Company Settings:</strong> Start by navigating to <em>Settings</em> and entering your company name, address, HST/GST number, and uploading your logo. This information appears on all invoices.</li>' +
                    '<li style="margin-bottom:8px"><strong>Payment Terms:</strong> Set your default payment terms (e.g., Net 30) and holdback percentage. In Ontario, the standard construction holdback is 10%.</li>' +
                    '<li style="margin-bottom:8px"><strong>Add Workers:</strong> Go to <em>Workers</em> and add each crew member. Assign them a unique PIN so they can clock in and submit time entries from the worker portal.</li>' +
                    '<li style="margin-bottom:8px"><strong>Add Clients:</strong> Navigate to <em>Clients</em> and create entries for your customers, including their billing address and contact information.</li>' +
                    '<li style="margin-bottom:8px"><strong>Create Your First Project:</strong> Go to <em>Projects</em>, click <strong>+ New Project</strong>, assign a client, and start adding subtasks to break down the scope of work.</li>' +
                '</ol>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> Use the <em>&ldquo;Walk me through it&rdquo;</em> button on the Settings page for a guided step-by-step setup wizard that highlights each field as you go.' +
                '</div>' +

                '<h4 style="margin-top:16px">Daily Workflow</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Workers log in with their PIN and submit daily time entries from the field.</li>' +
                    '<li style="margin-bottom:6px">Administrators review and approve or reject time submissions from the Approvals page.</li>' +
                    '<li style="margin-bottom:6px">Track expenses by category (Labour, Equipment, Material) against projects.</li>' +
                    '<li style="margin-bottom:6px">Generate and send invoices to clients as work progresses.</li>' +
                    '<li style="margin-bottom:6px">Record payments and track outstanding balances.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Navigation</h4>' +
                '<p>Use the sidebar on the left to move between sections. On mobile devices, tap the menu icon at the top left to open the sidebar. The <strong>Dashboard</strong> gives you an at-a-glance summary of active jobs, pending approvals, and outstanding invoices.</p>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> All data is stored locally on your device. Remember to back up regularly using the Data Backup feature in Settings.' +
                '</div>'
        },
        {
            id: 'company-settings',
            title: 'Company Settings',
            icon: '&#9881;',
            content:
                '<h4>Configuring Your Company Profile</h4>' +
                '<p>The Settings page stores all information that appears on your invoices and official documents.</p>' +

                '<h4 style="margin-top:16px">Company Information</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Company Name:</strong> Your registered business name as it should appear on invoices.</li>' +
                    '<li style="margin-bottom:6px"><strong>Address, City, Province, Postal Code:</strong> Your business mailing address. This is printed on all invoices and correspondence.</li>' +
                    '<li style="margin-bottom:6px"><strong>Phone &amp; Email:</strong> Primary contact details for your company.</li>' +
                    '<li style="margin-bottom:6px"><strong>HST/GST Number:</strong> Your CRA-issued Harmonized Sales Tax registration number. This is required on all invoices where HST is charged. The format is typically 9 digits followed by RT0001 (e.g., 123456789RT0001).</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Company Logo</h4>' +
                '<p>Upload your company logo as a PNG, JPG, or SVG file. The logo appears in the header of every invoice. For best results, use a logo with a transparent background and at least 300px width.</p>' +

                '<h4 style="margin-top:16px">Invoice Defaults</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Payment Terms:</strong> Set default payment due dates (e.g., Net 30, Net 60, Due on Receipt). This can be overridden per invoice.</li>' +
                    '<li style="margin-bottom:6px"><strong>HST Rate:</strong> The current Ontario HST rate is 13%. This is applied automatically to taxable line items.</li>' +
                    '<li style="margin-bottom:6px"><strong>Holdback Percentage:</strong> Under the Ontario Construction Act, the standard holdback is 10% of the invoice value. The system can calculate and display holdback amounts on invoices automatically.</li>' +
                    '<li style="margin-bottom:6px"><strong>Invoice Prefix:</strong> Optionally set a prefix for invoice numbers (e.g., &ldquo;INV-&rdquo; or &ldquo;BEL-&rdquo;) to keep your numbering organized.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Admin Password &amp; Session</h4>' +
                '<p>You can change the admin login password from the Settings page. Passwords must be at least 12 characters with mixed case, numbers, and special characters. You can also set the auto-logout timeout for inactive sessions (default: 30 minutes). If you forget your password, use the &ldquo;Forgot Password?&rdquo; link on the login screen to reset it via email.</p>' +

                '<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--warning)">Important:</strong> Make sure your HST number is entered correctly. Under Ontario law, invoices over $30 must include your HST registration number. Invoices with an incorrect or missing HST number may not be accepted by clients or meet CRA requirements.' +
                '</div>'
        },
        {
            id: 'client-management',
            title: 'Client Management',
            icon: '&#128101;',
            content:
                '<h4>Managing Your Clients</h4>' +
                '<p>The Clients section serves as your address book for all customers. Each client record is linked to projects and invoices.</p>' +

                '<h4 style="margin-top:16px">Adding a New Client</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Click <strong>+ Add Client</strong> at the top of the Clients page.</li>' +
                    '<li style="margin-bottom:6px">Enter the client&rsquo;s name (individual or company name). This is the only required field.</li>' +
                    '<li style="margin-bottom:6px">Fill in the billing address &mdash; this appears on invoices as the &ldquo;Bill To&rdquo; address.</li>' +
                    '<li style="margin-bottom:6px">Add contact information: phone number, email address, and optionally a contact person name if the client is a company.</li>' +
                    '<li style="margin-bottom:6px">Add any notes for internal reference (e.g., preferred communication method, special billing instructions).</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Editing &amp; Deleting Clients</h4>' +
                '<p>Click <strong>Edit</strong> next to any client to update their information. Click <strong>Delete</strong> to remove a client &mdash; you will be asked to confirm before deletion. Clients linked to active projects should be updated rather than deleted to preserve records.</p>' +

                '<h4 style="margin-top:16px">Searching Clients</h4>' +
                '<p>Use the search box at the top of the Clients page to quickly find clients by name, contact person, email, or phone number.</p>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> Keep client addresses up to date &mdash; they are automatically pulled into new invoices and projects. When creating a new project, selecting a client auto-fills all their details.' +
                '</div>'
        },
        {
            id: 'projects-subtasks',
            title: 'Projects & Subtasks',
            icon: '&#128204;',
            content:
                '<h4>Project Management</h4>' +
                '<p>Projects are the core organizational unit. Each project represents a construction job and is linked to a client. Projects contain subtasks that break down the scope of work.</p>' +

                '<h4 style="margin-top:16px">Creating a Project</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Click <strong>+ New Project</strong> on the Projects page (or use the wizard for guided setup).</li>' +
                    '<li style="margin-bottom:6px">Enter a descriptive project name (e.g., &ldquo;123 Main St - Kitchen Renovation&rdquo;).</li>' +
                    '<li style="margin-bottom:6px">Select the client from the dropdown, or type a new client name.</li>' +
                    '<li style="margin-bottom:6px">Add the job site address, contract/PO number, and project timeline.</li>' +
                    '<li style="margin-bottom:6px">Set the project status: <strong>Active</strong>, <strong>On Hold</strong>, or <strong>Completed</strong>.</li>' +
                    '<li style="margin-bottom:6px">Assign workers who will be logging time on this project.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Project Detail View</h4>' +
                '<p>Click on any project row to see its detail view with tabs for:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Subtasks</strong> &mdash; Break down the project scope into trackable units of work.</li>' +
                    '<li style="margin-bottom:6px"><strong>Expenses</strong> &mdash; View all expenses logged against this project.</li>' +
                    '<li style="margin-bottom:6px"><strong>Photos</strong> &mdash; View photos submitted by workers on site.</li>' +
                    '<li style="margin-bottom:6px"><strong>Invoices</strong> &mdash; See all invoices created for this project.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Subtasks</h4>' +
                '<p>Subtasks break a project into specific work items. Workers select a project and subtask when logging time, so subtasks should reflect the actual divisions of work on the job site.</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Examples: &ldquo;Demolition&rdquo;, &ldquo;Framing&rdquo;, &ldquo;Electrical Rough-In&rdquo;, &ldquo;Drywall&rdquo;, &ldquo;Finish Carpentry&rdquo;.</li>' +
                    '<li style="margin-bottom:6px">Each subtask can have its own budgeted quantity, unit of measure, and budgeted cost for tracking.</li>' +
                    '<li style="margin-bottom:6px">The subtask table shows actual vs. budgeted quantities and costs, making it easy to see where you are over or under budget.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Change Orders</h4>' +
                '<p>When the scope of a project changes, create a change order to document the modification. When adding a subtask, mark it as a <strong>Change Order</strong> if it represents extra work beyond the original scope. Change orders track:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Description of the change in scope.</li>' +
                    '<li style="margin-bottom:6px">Additional cost or credit amount.</li>' +
                    '<li style="margin-bottom:6px">Whether the change order has been approved by the client.</li>' +
                    '<li style="margin-bottom:6px">New subtasks added as a result of the change.</li>' +
                '</ul>' +

                '<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--warning)">Best Practice:</strong> Always document change orders in writing and get client approval before starting additional work. The system records the date each change order was created for your records.' +
                '</div>'
        },
        {
            id: 'worker-management',
            title: 'Worker Management',
            icon: '&#128119;',
            content:
                '<h4>Managing Your Crew</h4>' +
                '<p>The Workers section lets you add and manage crew members who will be logging time, uploading photos, and recording on-site activity through the worker portal.</p>' +

                '<h4 style="margin-top:16px">Adding a Worker</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Click <strong>+ Add Worker</strong> on the Workers page (or use the wizard for guided setup).</li>' +
                    '<li style="margin-bottom:6px">Enter the worker&rsquo;s full name.</li>' +
                    '<li style="margin-bottom:6px">Select a role: <strong>Worker</strong> (logs time) or <strong>Approver</strong> (can approve submissions in the field).</li>' +
                    '<li style="margin-bottom:6px">Assign a unique 4&ndash;6 digit PIN. This PIN is used by the worker to log in to the worker portal on-site.</li>' +
                    '<li style="margin-bottom:6px">Optionally set a default hourly rate for cost-tracking purposes.</li>' +
                    '<li style="margin-bottom:6px">Assign the worker to one or more projects.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Worker PINs</h4>' +
                '<p>PINs are the primary authentication method for the worker portal. Workers enter their PIN on a shared device at the job site to clock in, submit time, and upload photos.</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">PINs are masked by default in the worker list. Click <strong>Show</strong> to reveal a PIN.</li>' +
                    '<li style="margin-bottom:6px">Each PIN must be unique across all workers.</li>' +
                    '<li style="margin-bottom:6px">Use <strong>Reset PIN</strong> to generate a new random 4-digit PIN if needed.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Project Assignments</h4>' +
                '<p>Workers can be assigned to specific projects. When assigned, they will only see those projects in their worker portal, keeping the interface clean and preventing accidental time entries against the wrong job. Edit a worker to change their project assignments using the project checkboxes.</p>' +

                '<h4 style="margin-top:16px">Inviting Workers (Recommended)</h4>' +
                '<p>Instead of handing out PINs manually, use the <strong>Invite</strong> button to send each worker a secure setup link. This lets them choose their own PIN and optionally enable 2-factor authentication.</p>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Add the worker in the Workers page.</li>' +
                    '<li style="margin-bottom:6px">Click the green <strong>Invite</strong> button on their row.</li>' +
                    '<li style="margin-bottom:6px">A modal appears with a one-time invite link and a QR code.</li>' +
                    '<li style="margin-bottom:6px">Share the link or have the worker scan the QR code with their phone camera.</li>' +
                    '<li style="margin-bottom:6px">The worker opens the link, sets their own PIN, and optionally enables 2FA.</li>' +
                    '<li style="margin-bottom:6px">The invite link is single-use and expires after 7 days.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Two-Factor Authentication (2FA)</h4>' +
                '<p>Workers can enable 2FA during invite setup for added security. When enabled, they must enter their PIN <em>plus</em> a 6-digit code from their authenticator app to log in.</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Requires <strong>Google Authenticator</strong> or <strong>Authy</strong> on the worker&rsquo;s phone.</li>' +
                    '<li style="margin-bottom:6px">During setup, the worker scans a QR code with their authenticator app, then enters a 6-digit code to confirm it&rsquo;s working.</li>' +
                    '<li style="margin-bottom:6px">Each code is valid for 30 seconds and changes automatically.</li>' +
                    '<li style="margin-bottom:6px">If a worker loses access to their authenticator, use <strong>Reset PIN</strong> and re-invite them to set up a new PIN and 2FA.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Deactivating Workers</h4>' +
                '<p>If a worker leaves or is no longer active, set their status to <strong>Inactive</strong> rather than deleting them. This preserves their historical time entries and expense records while preventing new logins.</p>'
        },
        {
            id: 'time-approval',
            title: 'Time Approval',
            icon: '&#9201;',
            content:
                '<h4>Reviewing Time Submissions</h4>' +
                '<p>When workers submit time entries through the worker portal, those entries land in the <strong>Approvals</strong> queue for your review before being finalized.</p>' +

                '<h4 style="margin-top:16px">Approval Workflow</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Workers clock in and out, or manually enter their hours and units completed, via the worker portal.</li>' +
                    '<li style="margin-bottom:6px">Submitted entries appear in the <strong>Pending Approvals</strong> section of the admin panel.</li>' +
                    '<li style="margin-bottom:6px">Review each entry: check the worker name, project, subtask, date, hours, units, and any attached photos.</li>' +
                    '<li style="margin-bottom:6px">Click <strong>Approve</strong> to accept the entry, or <strong>Reject</strong> to send it back.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">What Happens After Approval</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Approved submissions count toward actual quantities in project subtask tracking.</li>' +
                    '<li style="margin-bottom:6px">They appear in labour reports and cost calculations.</li>' +
                    '<li style="margin-bottom:6px">Approved entries become part of the project&rsquo;s labour cost record and can be included on invoices.</li>' +
                    '<li style="margin-bottom:6px">Photos from approved submissions are visible in the project photo gallery.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Editing Time Entries</h4>' +
                '<p>If a worker made an error (e.g., wrong project or incorrect hours), you can edit the entry before approving it. All edits are logged in the Audit Log for accountability.</p>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> The Dashboard shows a count of pending approvals. Review submissions promptly so that your project reports and cost tracking remain up to date, especially on multi-crew projects.' +
                '</div>'
        },
        {
            id: 'expense-tracking',
            title: 'Expense Tracking',
            icon: '&#128176;',
            content:
                '<h4>Recording Project Expenses</h4>' +
                '<p>The Expenses section tracks all costs associated with your projects, organized into three categories: <strong>Labour</strong>, <strong>Equipment</strong>, and <strong>Materials</strong>.</p>' +

                '<h4 style="margin-top:16px">Expense Categories</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Labour:</strong> Worker wages and subcontractor costs. Labour expenses can be generated automatically from approved time entries multiplied by hourly rates, or entered manually.</li>' +
                    '<li style="margin-bottom:6px"><strong>Equipment:</strong> Costs for equipment rentals, fuel, maintenance, or owned equipment usage charges. Enter these manually as they are incurred.</li>' +
                    '<li style="margin-bottom:6px"><strong>Materials:</strong> Lumber, concrete, fixtures, fasteners, and all other material purchases. Track receipts and supplier information alongside the cost.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Billable vs. Non-Billable</h4>' +
                '<p>Each expense can be marked as <strong>Billable</strong> or <strong>Non-Billable</strong>:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Billable:</strong> Costs that will be passed on to the client and included as line items on invoices. Examples: materials purchased for the job, subcontractor charges.</li>' +
                    '<li style="margin-bottom:6px"><strong>Non-Billable:</strong> Internal costs that are part of your overhead and not charged to the client. Examples: tool replacement, travel between sites, office supplies.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Adding an Expense</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Click <strong>+ Add Expense</strong> on the Expenses page.</li>' +
                    '<li style="margin-bottom:6px">Select the project and optionally a subtask.</li>' +
                    '<li style="margin-bottom:6px">Choose the category (Labour, Equipment, or Materials).</li>' +
                    '<li style="margin-bottom:6px">Enter a description, amount, date, and vendor/supplier if applicable.</li>' +
                    '<li style="margin-bottom:6px">For labour expenses, you can link to a specific worker.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Invoice Status of Expenses</h4>' +
                '<p>Each expense tracks whether it has been included on an invoice:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Ready to Invoice</strong> &mdash; Not yet included on any invoice.</li>' +
                    '<li style="margin-bottom:6px"><strong>Invoiced</strong> &mdash; Already included on a generated invoice.</li>' +
                '</ul>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> Link expenses to specific subtasks to see accurate cost-per-unit calculations in the Cost Report. Recording expenses consistently helps you understand your true project costs and profit margins.' +
                '</div>'
        },
        {
            id: 'invoice-generation',
            title: 'Invoice Generation',
            icon: '&#128196;',
            content:
                '<h4>Creating Professional Invoices</h4>' +
                '<p>The Invoices section lets you generate, preview, and manage invoices that comply with Ontario requirements, including proper HST handling and Construction Act holdback provisions.</p>' +

                '<h4 style="margin-top:16px">Creating an Invoice</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Click <strong>+ New Invoice</strong> on the Invoices page.</li>' +
                    '<li style="margin-bottom:6px">Select the project. The client information is filled in automatically from the project record.</li>' +
                    '<li style="margin-bottom:6px">Set the invoice date and due date. The due date defaults based on your payment terms setting.</li>' +
                    '<li style="margin-bottom:6px">Add line items manually, or pull in billable expenses from the project.</li>' +
                    '<li style="margin-bottom:6px">Review the subtotal, HST calculation, holdback amount, and final total.</li>' +
                    '<li style="margin-bottom:6px">Preview the invoice, then save it. You can print or export to PDF from the preview.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Invoice Numbering</h4>' +
                '<p>Invoices are automatically numbered sequentially (e.g., INV-2026-0001). Numbers are sequential within each year and the prefix can be customized in Settings.</p>' +

                '<h4 style="margin-top:16px">Line Items</h4>' +
                '<p>Each line item includes a description, quantity, unit price, and total. You can add as many line items as needed. Common line items include:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Labour charges for specific subtasks or work phases.</li>' +
                    '<li style="margin-bottom:6px">Material costs with itemized descriptions.</li>' +
                    '<li style="margin-bottom:6px">Equipment rental or usage charges.</li>' +
                    '<li style="margin-bottom:6px">Change order amounts (added or credited).</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">HST Calculation</h4>' +
                '<p>HST at 13% is calculated automatically on the subtotal. Your HST/GST registration number is printed on the invoice from your Company Settings. Ensure your HST number is correct to maintain CRA compliance.</p>' +

                '<h4 style="margin-top:16px">Holdback (Ontario Construction Act)</h4>' +
                '<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius);padding:12px;margin-top:8px;margin-bottom:12px">' +
                    '<strong style="color:var(--warning)">Ontario Construction Act Compliance</strong>' +
                    '<p style="margin-top:6px">Under the Ontario <em>Construction Act</em> (formerly the Construction Lien Act), project owners are required to hold back 10% of the value of work done or materials supplied. Key points:</p>' +
                    '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                        '<li style="margin-bottom:6px">The basic holdback is <strong>10% of the contract price</strong> (or the price of work/materials as they are supplied).</li>' +
                        '<li style="margin-bottom:6px">Holdback must be retained for a minimum of <strong>60 days</strong> after the contract is completed or the last supply of services/materials, or after publication of the certificate or declaration of substantial performance (whichever applies).</li>' +
                        '<li style="margin-bottom:6px">The holdback amount is calculated on the <strong>pre-HST subtotal</strong>. HST is charged on the full amount, but the holdback is calculated before tax.</li>' +
                        '<li style="margin-bottom:6px">Finishing holdback and basic holdback have separate timelines. Be aware of both when billing on phased projects.</li>' +
                        '<li style="margin-bottom:6px">When holdback is released, issue a separate invoice or receipt for the holdback payment.</li>' +
                    '</ul>' +
                '</div>' +
                '<p>The system calculates holdback automatically. On each invoice, you will see:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Subtotal:</strong> Sum of all line items.</li>' +
                    '<li style="margin-bottom:6px"><strong>Holdback (10%):</strong> Deducted from the subtotal.</li>' +
                    '<li style="margin-bottom:6px"><strong>HST (13%):</strong> Calculated on the full subtotal.</li>' +
                    '<li style="margin-bottom:6px"><strong>Amount Due Now:</strong> Subtotal minus holdback, plus HST.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Proper Invoice Requirements</h4>' +
                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:8px">' +
                    '<strong style="color:var(--info)">Important:</strong> Under the Ontario Construction Act, a &ldquo;proper invoice&rdquo; must include specific information to trigger the statutory payment timeline. The app automatically includes most of these, but always verify before sending:' +
                    '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                        '<li style="margin-bottom:4px">Contractor&rsquo;s name and address</li>' +
                        '<li style="margin-bottom:4px">Date of the invoice</li>' +
                        '<li style="margin-bottom:4px">Name and address of the party being invoiced</li>' +
                        '<li style="margin-bottom:4px">Description of services or materials supplied</li>' +
                        '<li style="margin-bottom:4px">Amount payable, including HST</li>' +
                        '<li style="margin-bottom:4px">HST registration number</li>' +
                        '<li style="margin-bottom:4px">The contract period the invoice relates to</li>' +
                        '<li style="margin-bottom:4px">Project or job site address</li>' +
                        '<li style="margin-bottom:4px">Contract or purchase order number (if applicable)</li>' +
                    '</ul>' +
                '</div>' +

                '<h4 style="margin-top:16px">Payment Timelines Under the Act</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">An owner must pay a proper invoice within <strong>28 days</strong> of receiving it.</li>' +
                    '<li style="margin-bottom:6px">A general contractor must pay their subcontractors within <strong>7 days</strong> of receiving payment from the owner.</li>' +
                    '<li style="margin-bottom:6px">If a proper invoice is not paid on time, interest may be charged.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Invoice Status</h4>' +
                '<p>Invoices move through these statuses: <strong>Draft</strong> (editable, not yet sent), <strong>Sent</strong> (delivered to client), <strong>Partially Paid</strong>, <strong>Paid</strong>, and <strong>Overdue</strong> (past due date with outstanding balance). The system automatically marks invoices as overdue based on the due date.</p>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> Use the &ldquo;Pull Billable Expenses&rdquo; feature when creating an invoice to automatically import all un-invoiced billable expenses from the project as line items. This saves time and ensures nothing is missed.' +
                '</div>'
        },
        {
            id: 'payment-tracking',
            title: 'Payment Tracking',
            icon: '&#128179;',
            content:
                '<h4>Recording Payments</h4>' +
                '<p>Track payments received against invoices to maintain accurate accounts receivable records.</p>' +

                '<h4 style="margin-top:16px">Recording a Payment</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Navigate to the Invoices page and find the invoice the payment is for.</li>' +
                    '<li style="margin-bottom:6px">Click <strong>Record Payment</strong>.</li>' +
                    '<li style="margin-bottom:6px">Enter the payment amount, date received, and payment method (cheque, e-transfer, cash, credit card).</li>' +
                    '<li style="margin-bottom:6px">Optionally add a reference number (e.g., cheque number or e-transfer confirmation ID).</li>' +
                    '<li style="margin-bottom:6px">Save the payment. The invoice status updates automatically based on the remaining balance.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Partial Payments</h4>' +
                '<p>You can record multiple partial payments against a single invoice. The invoice status changes to <strong>Partially Paid</strong> until the full amount is received, at which point it becomes <strong>Paid</strong>.</p>' +

                '<h4 style="margin-top:16px">Payment Status Overview</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Unpaid</strong> &mdash; No payments received.</li>' +
                    '<li style="margin-bottom:6px"><strong>Partial</strong> &mdash; Some payment received, balance still owing.</li>' +
                    '<li style="margin-bottom:6px"><strong>Paid</strong> &mdash; Full amount received.</li>' +
                    '<li style="margin-bottom:6px"><strong>Overdue</strong> &mdash; Past the due date with balance owing.</li>' +
                '</ul>' +
                '<p>The Dashboard shows your total outstanding receivables and the number of overdue invoices. Use the Invoice Summary report for detailed aging information.</p>' +

                '<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--warning)">Holdback Payments:</strong> When a holdback amount is released by the client (after the statutory 60-day period), record it as a payment against the original invoice, or create a separate holdback release invoice depending on your accounting practice.' +
                '</div>'
        },
        {
            id: 'photo-management',
            title: 'Photo Management',
            icon: '&#128247;',
            content:
                '<h4>Site Photos</h4>' +
                '<p>Workers can upload photos from the job site through the worker portal. Photos are organized by project, date, and the worker who took them.</p>' +

                '<h4 style="margin-top:16px">Viewing Photos</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Navigate to <strong>Photos</strong> in the sidebar to see all photos across projects.</li>' +
                    '<li style="margin-bottom:6px">Select a project from the dropdown to filter by job.</li>' +
                    '<li style="margin-bottom:6px">Photos are organized by date and worker name.</li>' +
                    '<li style="margin-bottom:6px">Click any photo thumbnail to open a full-size lightbox preview.</li>' +
                    '<li style="margin-bottom:6px">Each photo shows metadata: who took it, when, and a description from the related time submission.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Exporting Photos</h4>' +
                '<p>You can export photos for use in reports, client communications, or documentation:</p>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Select a project that has photos.</li>' +
                    '<li style="margin-bottom:6px">Click <strong>Export Photos</strong>.</li>' +
                    '<li style="margin-bottom:6px">Choose a folder on your computer to save the photos to.</li>' +
                    '<li style="margin-bottom:6px">Photos will be saved with descriptive filenames including the project name, date, and worker.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Photo Storage</h4>' +
                '<p>Photos are stored locally in the browser&rsquo;s storage. Be aware that clearing browser data will remove photos. Use the <strong>Data Backup</strong> feature regularly to preserve your photo records along with all other application data.</p>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Tip:</strong> Encourage workers to take progress photos daily. They provide valuable documentation for client updates, dispute resolution, and project records. The Export Photos feature requires a modern browser (Chrome or Edge) that supports the File System Access API.' +
                '</div>'
        },
        {
            id: 'reports',
            title: 'Reports',
            icon: '&#128202;',
            content:
                '<h4>Generating Reports</h4>' +
                '<p>The Reports section provides insights into your project finances, labour utilization, and business performance.</p>' +

                '<h4 style="margin-top:16px">Available Reports</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:8px">' +
                        '<strong>Project Cost Report:</strong> Shows a breakdown of budgeted vs. actual costs by subtask for a selected project. Includes budgeted and actual quantities, budgeted and actual costs, variance (over/under budget highlighted in colour), cost per unit, and totals by category (Labour, Equipment, Materials).' +
                    '</li>' +
                    '<li style="margin-bottom:8px">' +
                        '<strong>Labour Report:</strong> Summarizes worker hours and amounts from approved time submissions. Filter by date range and specific project or all projects. Results are grouped by worker with subtotals and a grand total.' +
                    '</li>' +
                    '<li style="margin-bottom:8px">' +
                        '<strong>Expense Summary:</strong> Shows expenses grouped by category. Filter by project or view all projects with per-project breakdowns and a grand total. Helps ensure all billable costs are captured on invoices.' +
                    '</li>' +
                    '<li style="margin-bottom:8px">' +
                        '<strong>Invoice Summary:</strong> Overview of all invoices with status, amounts, payments received, and outstanding balances. Includes aging information and payment status badges (Paid, Partial, Unpaid, Overdue). Summary totals at the bottom.' +
                    '</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Filtering &amp; Date Ranges</h4>' +
                '<p>Reports support filtering by project, date range, and other criteria depending on the report type. Use start and end date selectors to narrow results to a specific period.</p>' +

                '<h4 style="margin-top:16px">Printing &amp; Exporting Reports</h4>' +
                '<p>Every report has a <strong>Print</strong> button. Use your browser&rsquo;s print dialog to print on paper or select &ldquo;Save as PDF&rdquo; as the destination to create a PDF file. The print view is formatted for clean, professional output on standard letter-size paper.</p>'
        },
        {
            id: 'data-backup',
            title: 'Data Backup & Restore',
            icon: '&#128190;',
            content:
                '<h4>Protecting Your Data</h4>' +
                '<p>All application data is stored locally in your browser. Regular backups are essential to prevent data loss from browser updates, clearing cache, or hardware failure.</p>' +

                '<h4 style="margin-top:16px">Creating a Backup</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Go to <strong>Settings</strong> and scroll to the <strong>Data Backup</strong> section.</li>' +
                    '<li style="margin-bottom:6px">Click <strong>Export Backup</strong>.</li>' +
                    '<li style="margin-bottom:6px">A JSON file will be downloaded containing all your data: settings, clients, projects, workers, time entries, expenses, invoices, payments, photos (encoded as base64), and audit logs.</li>' +
                    '<li style="margin-bottom:6px">Store this file in a safe location &mdash; ideally on a separate drive, cloud storage, or both.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Restoring from Backup</h4>' +
                '<ol style="list-style:decimal;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Go to <strong>Settings</strong> and scroll to the <strong>Data Backup</strong> section.</li>' +
                    '<li style="margin-bottom:6px">Click <strong>Import Backup</strong> and select your backup JSON file.</li>' +
                    '<li style="margin-bottom:6px">Confirm the import. <strong>Warning:</strong> Restoring a backup replaces ALL current data. Make a fresh backup before restoring if you want to preserve your current state.</li>' +
                '</ol>' +

                '<h4 style="margin-top:16px">Backup Reminders</h4>' +
                '<p>The system shows a reminder on the Dashboard if more than 30 days have passed since your last backup. It is recommended to back up at least weekly if you are actively managing projects.</p>' +

                '<h4 style="margin-top:16px">What Is Included in a Backup</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Company settings and admin password.</li>' +
                    '<li style="margin-bottom:6px">All workers, clients, projects, and subtasks.</li>' +
                    '<li style="margin-bottom:6px">All expenses, time submissions, invoices, and payments.</li>' +
                    '<li style="margin-bottom:6px">All photos (encoded as base64 in the backup file).</li>' +
                    '<li style="margin-bottom:6px">The complete audit log.</li>' +
                '</ul>' +

                '<div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--danger)">Warning:</strong> If you clear your browser data, switch browsers, or use a private/incognito window, your application data will not be available. Always maintain current backups.' +
                '</div>'
        },
        {
            id: 'audit-log',
            title: 'Audit Log',
            icon: '&#128269;',
            content:
                '<h4>Tracking System Activity</h4>' +
                '<p>The Audit Log records significant actions taken within the system, providing an accountability trail for administrative and financial operations.</p>' +

                '<h4 style="margin-top:16px">What Gets Logged</h4>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Creating, editing, and deleting projects, clients, and workers.</li>' +
                    '<li style="margin-bottom:6px">Approving and rejecting time submissions.</li>' +
                    '<li style="margin-bottom:6px">Editing time entries (both original and modified values are recorded).</li>' +
                    '<li style="margin-bottom:6px">Creating and modifying invoices.</li>' +
                    '<li style="margin-bottom:6px">Recording payments.</li>' +
                    '<li style="margin-bottom:6px">Adding and modifying expenses.</li>' +
                    '<li style="margin-bottom:6px">Changing company settings.</li>' +
                    '<li style="margin-bottom:6px">PIN resets for workers.</li>' +
                    '<li style="margin-bottom:6px">Importing and exporting data backups.</li>' +
                '</ul>' +

                '<h4 style="margin-top:16px">Log Entry Details</h4>' +
                '<p>Each log entry records:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px"><strong>Timestamp</strong> &mdash; Exact date and time of the action.</li>' +
                    '<li style="margin-bottom:6px"><strong>User</strong> &mdash; Who performed the action (admin or worker name).</li>' +
                    '<li style="margin-bottom:6px"><strong>Action</strong> &mdash; What type of action was taken.</li>' +
                    '<li style="margin-bottom:6px"><strong>Details</strong> &mdash; Additional context about what changed.</li>' +
                '</ul>' +
                '<p>The Dashboard shows the 10 most recent entries for quick reference.</p>' +

                '<h4 style="margin-top:16px">Using the Audit Log</h4>' +
                '<p>The audit log is useful for:</p>' +
                '<ul style="list-style:disc;padding-left:20px;margin-top:8px">' +
                    '<li style="margin-bottom:6px">Verifying who approved specific time entries and when.</li>' +
                    '<li style="margin-bottom:6px">Tracking changes to invoices before and after they were sent.</li>' +
                    '<li style="margin-bottom:6px">Investigating discrepancies in financial records.</li>' +
                    '<li style="margin-bottom:6px">Demonstrating due diligence in record-keeping for audits or disputes.</li>' +
                '</ul>' +

                '<div style="background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-top:16px">' +
                    '<strong style="color:var(--info)">Note:</strong> Audit log entries cannot be deleted or modified. They are included in data backups and restored along with all other data, providing a complete history of all changes made in the system.' +
                '</div>'
        }
    ],

    render(container) {
        var self = this;
        var esc = typeof Utils !== 'undefined' && Utils.escapeHtml
            ? Utils.escapeHtml
            : function(s) { return String(s).replace(/[&<>"']/g, function(m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); };

        container.innerHTML =
            '<h2 style="margin-bottom:16px">Help &amp; Documentation</h2>' +

            '<div class="card" style="margin-bottom:20px">' +
                '<div style="position:relative">' +
                    '<input type="text" id="helpSearchInput" placeholder="Search help topics..." ' +
                        'style="width:100%;padding:10px 14px 10px 36px;border-radius:var(--radius);border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);font-size:.95rem">' +
                    '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1rem;pointer-events:none">&#128270;</span>' +
                '</div>' +
                '<div id="helpSearchStatus" style="margin-top:8px;font-size:.85rem;color:var(--text-secondary);display:none"></div>' +
            '</div>' +

            '<div id="helpSectionsContainer">' +
                self._sections.map(function(section, idx) {
                    return '<div class="card help-section-card" data-section-id="' + section.id + '" style="margin-bottom:8px;overflow:hidden">' +
                        '<div class="help-section-header" data-idx="' + idx + '" ' +
                            'style="display:flex;align-items:center;gap:12px;cursor:pointer;padding:4px 0;user-select:none">' +
                            '<span style="font-size:1.3rem;flex-shrink:0;width:28px;text-align:center">' + section.icon + '</span>' +
                            '<span style="flex:1;font-weight:600;font-size:1rem;color:var(--text-primary)">' + esc(section.title) + '</span>' +
                            '<span class="help-chevron" id="helpChevron' + idx + '" ' +
                                'style="font-size:.8rem;color:var(--text-muted);transition:transform var(--transition-fast);transform:rotate(0deg)">&#9660;</span>' +
                        '</div>' +
                        '<div class="help-section-body" id="helpBody' + idx + '" ' +
                            'style="max-height:0;overflow:hidden;transition:max-height 0.35s ease;margin-top:0">' +
                            '<div style="padding:16px 0 4px 0;color:var(--text-secondary);font-size:.9rem;line-height:1.7">' +
                                section.content +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('') +
            '</div>' +

            '<div id="helpNoResults" class="card" style="display:none;text-align:center;padding:32px;color:var(--text-muted)">' +
                '<div style="font-size:2rem;margin-bottom:8px">&#128533;</div>' +
                '<p>No help topics match your search. Try different keywords.</p>' +
            '</div>' +

            '<div class="card" style="margin-top:16px;background:var(--amber-muted);border-color:var(--amber)">' +
                '<div style="display:flex;align-items:flex-start;gap:12px">' +
                    '<span style="font-size:1.4rem;flex-shrink:0">&#128161;</span>' +
                    '<div>' +
                        '<strong style="color:var(--amber)">Need More Help?</strong>' +
                        '<p style="margin-top:4px;font-size:.9rem;color:var(--text-secondary)">' +
                            'This application stores all data locally in your browser. For best results, use a modern version of Chrome, Firefox, Safari, or Edge. If you encounter issues, try clearing the browser cache (after backing up your data) or using a different browser.' +
                        '</p>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Bind accordion toggle
        container.querySelectorAll('.help-section-header').forEach(function(header) {
            header.addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                self._toggleSection(idx, container);
            });
        });

        // Bind search with debounce
        var searchInput = container.querySelector('#helpSearchInput');
        var searchTimer = null;
        searchInput.addEventListener('input', function() {
            var val = this.value.trim().toLowerCase();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                self._searchTerm = val;
                self._filterSections(container);
            }, 200);
        });

        // Auto-expand first section
        if (self._activeSection === null) {
            self._toggleSection(0, container);
        } else if (typeof self._activeSection === 'number') {
            self._toggleSection(self._activeSection, container);
        }
    },

    _toggleSection: function(idx, container) {
        var body = container.querySelector('#helpBody' + idx);
        var chevron = container.querySelector('#helpChevron' + idx);
        if (!body || !chevron) return;

        var isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';

        // Close all sections
        container.querySelectorAll('.help-section-body').forEach(function(b) {
            b.style.maxHeight = '0px';
            b.style.marginTop = '0';
        });
        container.querySelectorAll('.help-chevron').forEach(function(c) {
            c.style.transform = 'rotate(0deg)';
        });

        if (!isOpen) {
            // Open the clicked section
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.marginTop = '8px';
            chevron.style.transform = 'rotate(180deg)';
            this._activeSection = idx;
        } else {
            this._activeSection = null;
        }
    },

    _filterSections: function(container) {
        var term = this._searchTerm;
        var cards = container.querySelectorAll('.help-section-card');
        var statusEl = container.querySelector('#helpSearchStatus');
        var noResults = container.querySelector('#helpNoResults');
        var visibleCount = 0;

        if (!term) {
            cards.forEach(function(card) { card.style.display = ''; });
            statusEl.style.display = 'none';
            noResults.style.display = 'none';
            return;
        }

        var self = this;
        cards.forEach(function(card, i) {
            var section = self._sections[i];
            var textContent = (section.title + ' ' + section.content).replace(/<[^>]*>/g, ' ').toLowerCase();

            if (textContent.indexOf(term) !== -1) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            noResults.style.display = '';
            statusEl.style.display = 'none';
        } else {
            noResults.style.display = 'none';
            statusEl.style.display = '';
            statusEl.textContent = 'Showing ' + visibleCount + ' of ' + self._sections.length + ' topics matching \u201c' + term + '\u201d';
        }
    }
};
