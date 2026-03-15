// Worker Home Module
window.WorkerHome = {
    render(container, worker) {
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects();
        const activeProjects = projects.filter(function(p) {
            if (p.status !== 'Active') return false;
            // If assignedWorkers exists and is non-empty, only show to assigned workers
            var assigned = p.assignedWorkers || [];
            if (assigned.length > 0) {
                return assigned.indexOf(worker.id) !== -1;
            }
            // If no assignedWorkers set, all workers see the project
            return true;
        });

        // Count rejected submissions for this worker
        const submissions = AppData.getWorkerSubmissions(worker.id);
        const rejectedCount = submissions.filter(function(s) { return s.status === 'Rejected'; }).length;

        container.innerHTML = '';

        // Welcome section
        var welcomeCard = document.createElement('div');
        welcomeCard.className = 'card';
        welcomeCard.style.cssText = 'text-align:center;padding:24px';
        welcomeCard.innerHTML =
            '<h2 style="margin-bottom:8px">Welcome, ' + esc(worker.name) + '</h2>' +
            '<p style="color:var(--text2);font-size:.9rem">Select a project to log your time.</p>';
        container.appendChild(welcomeCard);

        // Rejected submissions badge
        if (rejectedCount > 0) {
            var rejectedBanner = document.createElement('div');
            rejectedBanner.className = 'card';
            rejectedBanner.style.cssText = 'border-color:var(--accent);background:rgba(233,69,96,.1);cursor:pointer;padding:16px';
            rejectedBanner.innerHTML =
                '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="background:var(--accent);color:#fff;font-size:.85rem;font-weight:700;padding:4px 12px;border-radius:12px">' + rejectedCount + '</span>' +
                    '<div style="flex:1">' +
                        '<strong style="color:var(--accent)">Rejected Submission' + (rejectedCount !== 1 ? 's' : '') + '</strong>' +
                        '<p style="font-size:.85rem;color:var(--text2);margin-top:2px">Tap to review and resubmit.</p>' +
                    '</div>' +
                    '<span style="color:var(--text2);font-size:1.2rem">&#8250;</span>' +
                '</div>';
            rejectedBanner.addEventListener('click', function() {
                window.App.navigateWorker('history');
            });
            container.appendChild(rejectedBanner);
        }

        // Active projects heading
        var heading = document.createElement('h3');
        heading.style.cssText = 'margin:20px 0 12px;font-size:1rem;color:var(--text2)';
        heading.textContent = 'Your Projects (' + activeProjects.length + ')';
        container.appendChild(heading);

        // Project cards
        if (activeProjects.length === 0) {
            var emptyDiv = document.createElement('div');
            emptyDiv.className = 'card';
            emptyDiv.style.cssText = 'text-align:center;padding:40px 20px';
            emptyDiv.innerHTML =
                '<h3 style="color:var(--text);margin-bottom:8px">No Active Projects</h3>' +
                '<p style="color:var(--text2);font-size:.9rem">You have no projects assigned to you right now. Contact your supervisor if you think this is an error.</p>';
            container.appendChild(emptyDiv);
        } else {
            activeProjects.forEach(function(project) {
                var client = AppData.getClient(project.clientId);
                var clientName = client ? client.name : (project.clientName || project.client || '');
                var address = project.jobSiteAddress || project.address || '';

                var card = document.createElement('div');
                card.className = 'card';
                card.style.cssText = 'cursor:pointer;padding:16px;transition:background .15s';
                card.innerHTML =
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
                        '<div style="flex:1;min-width:0">' +
                            '<div style="font-weight:700;font-size:1.05rem;margin-bottom:4px">' + esc(project.name) + '</div>' +
                            (clientName ? '<div style="font-size:.85rem;color:var(--text2);margin-bottom:4px">' + esc(clientName) + '</div>' : '') +
                            (address ? '<div style="font-size:.85rem;color:var(--text2)">' + esc(address) + '</div>' : '') +
                        '</div>' +
                        '<div>' +
                            '<span style="font-size:.75rem;padding:4px 10px;border-radius:12px;font-weight:600;background:rgba(46,204,113,.2);color:var(--success)">' + esc(project.status) + '</span>' +
                        '</div>' +
                    '</div>';

                card.addEventListener('mouseenter', function() {
                    card.style.background = 'rgba(245,158,11,.08)';
                });
                card.addEventListener('mouseleave', function() {
                    card.style.background = '';
                });
                card.addEventListener('click', function() {
                    window.App.navigateWorker('timeentry', project.id);
                });

                container.appendChild(card);
            });
        }
    }
};
