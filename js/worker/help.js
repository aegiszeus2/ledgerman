// Worker Help Module
window.WorkerHelp = {
    render(container) {
        var esc = Utils.escapeHtml;
        var sectionIndex = 0;

        container.innerHTML = '';

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap';
        header.innerHTML =
            '<button class="btn-secondary btn-sm" id="helpBack" style="padding:8px 16px;font-size:.95rem">&larr; Back</button>' +
            '<h2 style="flex:1;font-size:1.15rem">Help &amp; Guide</h2>';
        container.appendChild(header);

        header.querySelector('#helpBack').addEventListener('click', function() {
            window.App.navigateWorker('home');
        });

        // Intro
        var introCard = document.createElement('div');
        introCard.className = 'card';
        introCard.style.cssText = 'padding:20px;margin-bottom:16px';
        introCard.innerHTML =
            '<p style="font-size:.95rem;color:var(--text)">Tap any section below to expand it. If you need more help, contact your supervisor.</p>';
        container.appendChild(introCard);

        // Help sections
        var sections = [
            {
                title: 'How to Log In',
                content:
                    '<p>To log in to the worker portal:</p>' +
                    '<ol style="margin:10px 0 0 20px;line-height:1.8">' +
                        '<li>Open the app on your phone or tablet.</li>' +
                        '<li>Select <strong>Worker Login</strong> on the main screen.</li>' +
                        '<li>Enter the <strong>PIN</strong> your admin gave you.</li>' +
                        '<li>Tap <strong>Log In</strong>. You will see your home screen with your projects.</li>' +
                    '</ol>' +
                    '<p style="margin-top:10px;color:var(--text2);font-size:.9rem">If your PIN does not work, ask your supervisor for help.</p>'
            },
            {
                title: 'How to Submit Time',
                content:
                    '<p>Follow these steps to submit your time for a project:</p>' +
                    '<ol style="margin:10px 0 0 20px;line-height:1.8">' +
                        '<li><strong>Select your project</strong> from the home screen by tapping its card.</li>' +
                        '<li><strong>Pick the date</strong> for the work. It defaults to today, but you can change it.</li>' +
                        '<li><strong>Select a subtask</strong> if one applies to the work you did (this is optional).</li>' +
                        '<li><strong>Choose Hourly or Flat Rate</strong> and enter the amounts.' +
                            '<ul style="margin:6px 0 6px 16px;list-style:disc">' +
                                '<li><em>Hourly:</em> Enter the hours you worked and your hourly rate.</li>' +
                                '<li><em>Flat Rate:</em> Enter the total flat rate amount.</li>' +
                            '</ul>' +
                        '</li>' +
                        '<li><strong>Describe the work you did</strong> in the description box. Be specific &mdash; this text appears on the invoice your client sees.</li>' +
                        '<li><strong>Add photos</strong> if needed (see below for details).</li>' +
                        '<li>Tap the <strong>Submit</strong> button at the bottom.</li>' +
                    '</ol>' +
                    '<p style="margin-top:10px;color:var(--text2);font-size:.9rem">After submitting, your entry goes to your foreman or admin for approval.</p>'
            },
            {
                title: 'How to Attach Photos',
                content:
                    '<p>You can attach photos of your work to any time entry. There are two ways:</p>' +
                    '<ul style="margin:10px 0 0 20px;line-height:1.8;list-style:disc">' +
                        '<li><strong>Take Photo</strong> &mdash; Opens your phone camera so you can take a picture on the spot. Great for showing progress or completed work.</li>' +
                        '<li><strong>Choose File</strong> &mdash; Pick one or more photos from your phone gallery. You can select multiple photos at once.</li>' +
                    '</ul>' +
                    '<p style="margin-top:10px">After adding photos, you will see small thumbnail previews. Tap the <strong>X</strong> on any thumbnail to remove it before submitting.</p>' +
                    '<p style="margin-top:8px;color:var(--text2);font-size:.9rem">Photos help your admin verify the work and can be used for project records.</p>'
            },
            {
                title: 'How to Enter Units of Completion',
                content:
                    '<p>Some subtasks track units of work (for example, square feet of flooring installed or linear feet of pipe laid).</p>' +
                    '<p style="margin-top:10px">When you select a subtask that has a <strong>unit of measure</strong>, a new field called <strong>Units Completed</strong> will appear automatically.</p>' +
                    '<ul style="margin:10px 0 0 20px;line-height:1.8;list-style:disc">' +
                        '<li>Enter the number of units you completed that day.</li>' +
                        '<li>The unit label (e.g., sq ft, linear ft) is shown next to the input.</li>' +
                        '<li>This helps your admin track overall project progress.</li>' +
                    '</ul>'
            },
            {
                title: 'How to Check If Your Time Was Approved',
                content:
                    '<p>To check the status of your submitted time entries:</p>' +
                    '<ol style="margin:10px 0 0 20px;line-height:1.8">' +
                        '<li>Go to <strong>History</strong> from the menu.</li>' +
                        '<li>You will see all your submissions listed with a status badge:</li>' +
                    '</ol>' +
                    '<ul style="margin:10px 0 0 36px;line-height:1.8;list-style:disc">' +
                        '<li><span style="color:var(--warn);font-weight:600">Pending</span> &mdash; Waiting for your admin to review.</li>' +
                        '<li><span style="color:var(--success);font-weight:600">Approved</span> &mdash; Your time has been approved.</li>' +
                        '<li><span style="color:var(--accent);font-weight:600">Rejected</span> &mdash; Your admin needs you to fix something (see below).</li>' +
                    '</ul>'
            },
            {
                title: 'What to Do If Your Submission Is Rejected',
                content:
                    '<p>If your submission is rejected:</p>' +
                    '<ol style="margin:10px 0 0 20px;line-height:1.8">' +
                        '<li>Go to <strong>History</strong> and filter by <strong>Rejected</strong>.</li>' +
                        '<li>Read the <strong>rejection reason</strong> shown in red on the card. This tells you what needs fixing.</li>' +
                        '<li>Tap <strong>Resubmit This Entry</strong>. The form will open pre-filled with your original information.</li>' +
                        '<li>Make the needed corrections (fix hours, update description, etc.).</li>' +
                        '<li>Re-add any photos if needed.</li>' +
                        '<li>Tap <strong>Submit</strong> again.</li>' +
                    '</ol>' +
                    '<p style="margin-top:10px;color:var(--text2);font-size:.9rem">The corrected entry goes back for approval as a new submission.</p>'
            }
        ];

        sections.forEach(function(section) {
            container.appendChild(createCollapsible(section.title, section.content));
        });

        // FAQ section heading
        var faqHeading = document.createElement('h3');
        faqHeading.style.cssText = 'margin:24px 0 12px;font-size:1rem;color:var(--text2)';
        faqHeading.textContent = 'Frequently Asked Questions';
        container.appendChild(faqHeading);

        var faqs = [
            {
                title: 'Why was my time rejected?',
                content: '<p>Check the <strong>rejection reason</strong> shown on your rejected submission in History. Common reasons include incorrect hours, missing description, or wrong project. Fix the issues and resubmit.</p>'
            },
            {
                title: 'Can I edit a submitted entry?',
                content: '<p>You cannot edit entries that are <strong>Pending</strong> or <strong>Approved</strong>. Only <strong>Rejected</strong> entries can be resubmitted with edits. If you need to change a pending entry, ask your admin to reject it so you can resubmit.</p>'
            },
            {
                title: 'Who sees my photos?',
                content: '<p>Your <strong>foreman and admin</strong> see your photos when reviewing your submission for approval. Photos may also be included in project records and documentation. They are not shared outside of the company.</p>'
            },
            {
                title: 'What if I forgot to submit time for a previous day?',
                content: '<p>No problem. When submitting a time entry, you can <strong>change the date</strong> to any previous day. Just make sure you select the correct date before submitting.</p>'
            },
            {
                title: 'Why don\'t I see a project?',
                content: '<p>You only see projects you have been <strong>assigned to by your admin</strong>. If you expect to see a project but it is not listed, your admin may not have assigned you yet or may have removed you. Contact your supervisor to get added.</p>'
            }
        ];

        faqs.forEach(function(faq) {
            container.appendChild(createCollapsible(faq.title, faq.content));
        });

        function createCollapsible(title, contentHTML) {
            var wrapper = document.createElement('div');
            wrapper.className = 'card';
            wrapper.style.cssText = 'padding:0;margin-bottom:8px;overflow:hidden';

            var headerBtn = document.createElement('button');
            headerBtn.type = 'button';
            headerBtn.style.cssText = 'width:100%;text-align:left;padding:16px 20px;background:transparent;color:var(--text);font-size:.95rem;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:12px;border:none;cursor:pointer;border-radius:0';

            var titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            headerBtn.appendChild(titleSpan);

            var arrow = document.createElement('span');
            arrow.style.cssText = 'font-size:1.2rem;color:var(--text2);transition:transform .2s;flex-shrink:0';
            arrow.innerHTML = '&#9660;';
            headerBtn.appendChild(arrow);

            var body = document.createElement('div');
            body.style.cssText = 'padding:0 20px 16px;font-size:.9rem;line-height:1.6;color:var(--text);display:none';
            body.innerHTML = contentHTML;

            var isOpen = false;
            headerBtn.addEventListener('click', function() {
                isOpen = !isOpen;
                body.style.display = isOpen ? '' : 'none';
                arrow.style.transform = isOpen ? 'rotate(180deg)' : '';
            });

            wrapper.appendChild(headerBtn);
            wrapper.appendChild(body);
            return wrapper;
        }
    }
};
