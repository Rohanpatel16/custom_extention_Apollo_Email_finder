/**
 * main.js
 * Standalone demo script for the Apollo Email Finder Redesign.
 */

const MOCK_DATA = [
    {
        id: 1,
        name: "Sarah Jenkins",
        title: "Senior VP of Engineering",
        company: "Vercel",
        domain: "vercel.com",
        location: "San Francisco, CA",
        status: "verified",
        email: "sarah.j@vercel.com"
    },
    {
        id: 2,
        name: "Marcus Aurelius",
        title: "Growth Marketing Manager",
        company: "Stripe",
        domain: "stripe.com",
        location: "London, UK",
        status: "pending",
        email: "marcus@stripe.com"
    },
    {
        id: 3,
        name: "Elena Rodriguez",
        title: "Director of Product",
        company: "OpenAI",
        domain: "openai.com",
        location: "San Francisco, CA",
        status: "verified",
        email: "elena@openai.com"
    },
    {
        id: 4,
        name: "David Chen",
        title: "Founder & CEO",
        company: "Linear",
        domain: "linear.app",
        location: "Berlin, DE",
        status: "failed",
        email: "david@linear.app"
    },
    {
        id: 5,
        name: "Jessica Wu",
        title: "Talent Acquisition",
        company: "Figma",
        domain: "figma.com",
        location: "New York, NY",
        status: "verified",
        email: "jessica@figma.com"
    },
    {
        id: 6,
        name: "Kevin Adams",
        title: "Sales Director",
        company: "Intercom",
        domain: "intercom.com",
        location: "Dublin, IE",
        status: "verified",
        email: "kevin@intercom.com"
    }
];

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    tbody.innerHTML = MOCK_DATA.map(p => `
        <tr>
            <td><input type="checkbox"></td>
            <td>
                <div class="profile-cell">
                    <div class="avatar">${p.name.split(' ').map(n => n[0]).join('')}</div>
                    <div class="name-wrapper">
                        <span class="name">${p.name}</span>
                        <span class="title">${p.title}</span>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-weight: 500;">${p.company}</div>
                <div style="font-size: 11px; color: var(--text-dim);">${p.domain}</div>
            </td>
            <td>
                <div style="color: var(--text-secondary);">${p.location}</div>
            </td>
            <td>
                <span class="status-badge status-${p.status}">
                    ${p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <a href="#" style="color: var(--text-dim);"><i data-lucide="linkedin" style="width: 16px;"></i></a>
                    <a href="#" style="color: var(--text-dim);"><i data-lucide="globe" style="width: 16px;"></i></a>
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon" title="Copy Email"><i data-lucide="copy" style="width: 14px;"></i></button>
                    <button class="btn-icon" title="Delete"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    // Re-initialize Lucide icons for the new rows
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Interactivity
document.addEventListener('DOMContentLoaded', () => {
    renderTable();

    // Tab switching simulation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Search simulation
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
});
