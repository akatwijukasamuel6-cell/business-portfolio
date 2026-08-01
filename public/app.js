const API_BASE = '';

let authState = { user: null, csrfToken: null };
const jobTitles = {};

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    initAdminTabs();
    initContactForm();
    initAdminLogin();
    initImageUploads();
});

const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-links a');

    pages.forEach(page => {
        page.classList.remove('active');
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    document.getElementById(pageId).classList.add('active');

    if (pageId === 'admin') {
        checkAdminAuth();
    }

    if (window.innerWidth <= 768) {
        document.querySelector('.nav-links').classList.remove('active');
    }
}

function toggleMobileMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
}

// ---------------------------------------------------------------------------
// Auth (admin login)
// ---------------------------------------------------------------------------

function authHeaders(extra = {}) {
    const headers = { ...extra };
    if (authState.csrfToken) {
        headers['X-CSRF-Token'] = authState.csrfToken;
    }
    return headers;
}

async function authFetch(url, options = {}) {
    options.headers = authHeaders(options.headers || {});
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        authState.user = null;
        authState.csrfToken = null;
        showAdminLogin();
    }
    return response;
}

function showAdminLogin() {
    document.getElementById('admin-login').style.display = 'block';
    document.getElementById('admin-dashboard').style.display = 'none';
}

function showAdminDashboard() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
}

async function checkAdminAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`);
        if (response.ok) {
            const data = await response.json();
            authState.user = data.user;
            authState.csrfToken = data.csrfToken;
            document.getElementById('admin-username').textContent = authState.user.username;
            showAdminDashboard();
            loadApplications();
        } else {
            showAdminLogin();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAdminLogin();
    }
}

function initAdminLogin() {
    const form = document.getElementById('admin-login-form');
    form.addEventListener('submit', handleLogin);
    applyPersistedLoginLock();
}

// Login lock with countdown (persisted across reloads via localStorage).
const LOGIN_LOCK_KEY = 'adminLoginLock';
const LOGIN_FAILS_KEY = 'adminLoginFails';
let loginCountdownTimer = null;

function getLoginLockRemaining() {
    let lock = null;
    try {
        lock = JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) || 'null');
    } catch (e) {
        lock = null;
    }
    if (!lock || !lock.until) return 0;
    const remaining = lock.until - Date.now();
    if (remaining <= 0) {
        localStorage.removeItem(LOGIN_LOCK_KEY);
        localStorage.removeItem(LOGIN_FAILS_KEY);
        return 0;
    }
    return remaining;
}

function registerLoginFailure() {
    const fails = parseInt(localStorage.getItem(LOGIN_FAILS_KEY) || '0', 10) + 1;
    localStorage.setItem(LOGIN_FAILS_KEY, fails);
    const delayMs = Math.min(fails * 10, 60) * 1000;
    localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify({ until: Date.now() + delayMs }));
    return delayMs;
}

function clearLoginLock() {
    localStorage.removeItem(LOGIN_LOCK_KEY);
    localStorage.removeItem(LOGIN_FAILS_KEY);
}

function applyPersistedLoginLock() {
    const remaining = getLoginLockRemaining();
    if (remaining > 0) startLoginCountdown(remaining);
}

function startLoginCountdown(milliseconds) {
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const end = Date.now() + milliseconds;

    if (loginCountdownTimer) clearTimeout(loginCountdownTimer);
    btn.disabled = true;

    const tick = () => {
        const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (remaining <= 0) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
            errorEl.style.display = 'none';
            loginCountdownTimer = null;
            return;
        }
        btn.textContent = `Try again in ${remaining}s`;
        errorEl.textContent = `Too many failed attempts. Try again in ${remaining} seconds.`;
        errorEl.style.display = 'block';
        loginCountdownTimer = setTimeout(tick, 1000);
    };
    tick();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    const lockRemaining = getLoginLockRemaining();
    if (lockRemaining > 0) {
        startLoginCountdown(lockRemaining);
        return;
    }

    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            clearLoginLock();
            authState.user = data.user;
            authState.csrfToken = data.csrfToken;
            document.getElementById('admin-username').textContent = authState.user.username;
            e.target.reset();
            showAdminDashboard();
            loadApplications();
        } else {
            const delayMs = registerLoginFailure();
            errorEl.textContent = data.error || 'Login failed';
            errorEl.style.display = 'block';
            startLoginCountdown(delayMs);
        }
    } catch (error) {
        errorEl.textContent = 'An error occurred. Please try again.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

async function logoutAdmin() {
    try {
        await authFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    authState.user = null;
    authState.csrfToken = null;
    showAdminLogin();
}

// ---------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------

function initImageUploads() {
    const uploads = [
        { input: 'project-image-upload', url: 'project-image', preview: 'project-image-preview' },
        { input: 'testimonial-avatar-upload', url: 'testimonial-avatar', preview: 'testimonial-avatar-preview' },
        { input: 'team-member-image-upload', url: 'team-member-image', preview: 'team-member-image-preview' }
    ];
    uploads.forEach(({ input, url, preview }) => {
        const el = document.getElementById(input);
        if (!el) return;
        el.addEventListener('change', (e) => handleImageUpload(e, url, preview));
    });
}

function setImagePreview(previewId, url) {
    const img = document.getElementById(previewId);
    if (!img) return;
    if (url) {
        img.src = url;
        img.style.display = 'block';
    } else {
        img.src = '';
        img.style.display = 'none';
    }
}

async function handleImageUpload(e, urlInputId, previewId) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please choose an image file (JPG, PNG, GIF, etc).');
        input.value = '';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Image is too large. Maximum size is 5MB.');
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await authFetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            document.getElementById(urlInputId).value = data.url;
            setImagePreview(previewId, data.url);
        } else {
            alert(data.error || 'Upload failed. Please try again.');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed. Please try again.');
    }
}

// ---------------------------------------------------------------------------
// Public data loading
// ---------------------------------------------------------------------------

async function loadAllData() {
    await Promise.all([
        loadAbout(),
        loadServices(),
        loadProjects(),
        loadBlog(),
        loadContact(),
        loadTestimonials(),
        loadTeam(),
        loadCareers()
    ]);
    initStatsCounter();
}

async function loadAbout() {
    try {
        const response = await fetch(`${API_BASE}/api/pages/about`);
        const data = await response.json();

        document.getElementById('about-content').innerHTML = `<p>${escapeHtml(data.content)}</p>`;
        document.getElementById('mission-text').textContent = data.mission;
        document.getElementById('vision-text').textContent = data.vision;

        document.getElementById('about-content-editor').value = data.content;
        document.getElementById('about-mission').value = data.mission;
        document.getElementById('about-vision').value = data.vision;
    } catch (error) {
        console.error('Error loading about:', error);
    }
}

async function loadServices() {
    try {
        const response = await fetch(`${API_BASE}/api/services`);
        const services = await response.json();

        const grid = document.getElementById('services-grid');
        grid.innerHTML = services.map(service => `
            <div class="service-card">
                <i class="fas fa-${escapeHtml(service.icon)}"></i>
                <h3>${escapeHtml(service.title)}</h3>
                <p>${escapeHtml(service.description)}</p>
            </div>
        `).join('');

        renderServicesAdmin(services);
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const projects = await response.json();

        const grid = document.getElementById('portfolio-grid');
        grid.innerHTML = projects.map(project => `
            <div class="portfolio-item" data-category="${escapeHtml(project.category)}">
                <img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.title)}" onerror="this.src='/images/project-1.jpg'">
                <div class="portfolio-item-content">
                    <h3>${escapeHtml(project.title)}</h3>
                    <p>${escapeHtml(project.description)}</p>
                    <span class="category">${escapeHtml(project.category)}</span>
                </div>
            </div>
        `).join('');

        renderProjectsAdmin(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function loadBlog() {
    try {
        const response = await fetch(`${API_BASE}/api/blog`);
        const posts = await response.json();

        const grid = document.getElementById('blog-grid');
        grid.innerHTML = posts.map(post => `
            <div class="blog-card">
                <div class="blog-card-content">
                    <div class="date">${escapeHtml(post.date)}</div>
                    <h3>${escapeHtml(post.title)}</h3>
                    <p>${escapeHtml(post.content.substring(0, 150))}...</p>
                    <span class="author">By ${escapeHtml(post.author)}</span>
                </div>
            </div>
        `).join('');

        renderBlogAdmin(posts);
    } catch (error) {
        console.error('Error loading blog:', error);
    }
}

async function loadContact() {
    try {
        const response = await fetch(`${API_BASE}/api/pages/contact`);
        const data = await response.json();

        const info = document.getElementById('contact-info');
        info.innerHTML = `
            <div class="contact-item">
                <i class="fas fa-envelope"></i>
                <span>${escapeHtml(data.email)}</span>
            </div>
            <div class="contact-item">
                <i class="fas fa-phone"></i>
                <span>${escapeHtml(data.phone)}</span>
            </div>
            <div class="contact-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${escapeHtml(data.address)}</span>
            </div>
            <div class="social-links">
                <a href="${escapeHtml(data.social.twitter)}"><i class="fab fa-twitter"></i></a>
                <a href="${escapeHtml(data.social.linkedin)}"><i class="fab fa-linkedin"></i></a>
                <a href="${escapeHtml(data.social.github)}"><i class="fab fa-github"></i></a>
            </div>
        `;

        document.getElementById('contact-email').value = data.email;
        document.getElementById('contact-phone').value = data.phone;
        document.getElementById('contact-address').value = data.address;
    } catch (error) {
        console.error('Error loading contact:', error);
    }
}

// ---------------------------------------------------------------------------
// Admin render helpers
// ---------------------------------------------------------------------------

function renderProjectsAdmin(projects) {
    const list = document.getElementById('projects-list');
    list.innerHTML = projects.map(project => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(project.title)}</h4>
                <p>${escapeHtml(project.category)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editProject(${project.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteProject(${project.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderServicesAdmin(services) {
    const list = document.getElementById('services-list');
    list.innerHTML = services.map(service => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(service.title)}</h4>
                <p>${escapeHtml(service.description.substring(0, 50))}...</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editService(${service.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteService(${service.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderBlogAdmin(posts) {
    const list = document.getElementById('blog-list');
    list.innerHTML = posts.map(post => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(post.title)}</h4>
                <p>${escapeHtml(post.date)} - ${escapeHtml(post.author)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editBlog(${post.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteBlog(${post.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function initAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const panels = document.querySelectorAll('.admin-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');

            if (tab.dataset.tab === 'applications') {
                loadApplications();
            } else if (tab.dataset.tab === 'messages') {
                loadMessages();
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Projects (write)
// ---------------------------------------------------------------------------

async function saveProject(e) {
    e.preventDefault();

    const id = document.getElementById('project-id').value;
    const data = {
        title: document.getElementById('project-title').value,
        description: document.getElementById('project-description').value,
        image: document.getElementById('project-image').value,
        category: document.getElementById('project-category').value,
        link: document.getElementById('project-link').value
    };

    try {
        const response = await authFetch(`${API_BASE}/api/projects${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);

        hideForm('project');
        e.target.reset();
        loadProjects();
    } catch (error) {
        console.error('Error saving project:', error);
    }
}

async function editProject(id) {
    try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const projects = await response.json();
        const project = projects.find(p => p.id == id);

        if (project) {
            document.getElementById('project-id').value = project.id;
            document.getElementById('project-title').value = project.title;
            document.getElementById('project-description').value = project.description;
            document.getElementById('project-image').value = project.image;
            document.getElementById('project-category').value = project.category;
            document.getElementById('project-link').value = project.link;
            setImagePreview('project-image-preview', project.image);

            document.getElementById('project-form').style.display = 'block';
        }
    } catch (error) {
        console.error('Error editing project:', error);
    }
}

async function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project?')) {
        try {
            const response = await authFetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
            if (response.ok) loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    }
}

// ---------------------------------------------------------------------------
// Services (write)
// ---------------------------------------------------------------------------

async function saveService(e) {
    e.preventDefault();

    const id = document.getElementById('service-id').value;
    const data = {
        title: document.getElementById('service-title').value,
        description: document.getElementById('service-description').value,
        icon: document.getElementById('service-icon').value
    };

    try {
        const response = await authFetch(`${API_BASE}/api/services${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);

        hideForm('service');
        e.target.reset();
        loadServices();
    } catch (error) {
        console.error('Error saving service:', error);
    }
}

async function editService(id) {
    try {
        const response = await fetch(`${API_BASE}/api/services`);
        const services = await response.json();
        const service = services.find(s => s.id === id);

        if (service) {
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-title').value = service.title;
            document.getElementById('service-description').value = service.description;
            document.getElementById('service-icon').value = service.icon;

            document.getElementById('service-form').style.display = 'block';
        }
    } catch (error) {
        console.error('Error editing service:', error);
    }
}

async function deleteService(id) {
    if (confirm('Are you sure you want to delete this service?')) {
        try {
            const response = await authFetch(`${API_BASE}/api/services/${id}`, { method: 'DELETE' });
            if (response.ok) loadServices();
        } catch (error) {
            console.error('Error deleting service:', error);
        }
    }
}

// ---------------------------------------------------------------------------
// Blog (write)
// ---------------------------------------------------------------------------

async function saveBlog(e) {
    e.preventDefault();

    const id = document.getElementById('blog-id').value;
    const data = {
        title: document.getElementById('blog-title').value,
        content: document.getElementById('blog-content').value,
        author: document.getElementById('blog-author').value
    };

    try {
        const response = await authFetch(`${API_BASE}/api/blog${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);

        hideForm('blog');
        e.target.reset();
        loadBlog();
    } catch (error) {
        console.error('Error saving blog post:', error);
    }
}

async function editBlog(id) {
    try {
        const response = await fetch(`${API_BASE}/api/blog`);
        const posts = await response.json();
        const post = posts.find(p => p.id === id);

        if (post) {
            document.getElementById('blog-id').value = post.id;
            document.getElementById('blog-title').value = post.title;
            document.getElementById('blog-content').value = post.content;
            document.getElementById('blog-author').value = post.author;

            document.getElementById('blog-form').style.display = 'block';
        }
    } catch (error) {
        console.error('Error editing blog post:', error);
    }
}

async function deleteBlog(id) {
    if (confirm('Are you sure you want to delete this blog post?')) {
        try {
            const response = await authFetch(`${API_BASE}/api/blog/${id}`, { method: 'DELETE' });
            if (response.ok) loadBlog();
        } catch (error) {
            console.error('Error deleting blog post:', error);
        }
    }
}

// ---------------------------------------------------------------------------
// Pages (write)
// ---------------------------------------------------------------------------

async function saveAbout(e) {
    e.preventDefault();

    const data = {
        content: document.getElementById('about-content-editor').value,
        mission: document.getElementById('about-mission').value,
        vision: document.getElementById('about-vision').value
    };

    try {
        const response = await authFetch(`${API_BASE}/api/pages/about`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);

        alert('About page saved successfully!');
        loadAbout();
    } catch (error) {
        console.error('Error saving about:', error);
    }
}

async function saveContact(e) {
    e.preventDefault();

    const data = {
        email: document.getElementById('contact-email').value,
        phone: document.getElementById('contact-phone').value,
        address: document.getElementById('contact-address').value
    };

    try {
        const response = await authFetch(`${API_BASE}/api/pages/contact`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Contact page saved successfully!');
            loadContact();
        } else {
            const err = await response.json().catch(() => ({}));
            alert(err.error || 'Failed to save contact information');
        }
    } catch (error) {
        console.error('Error saving contact:', error);
        alert('Error saving contact: ' + error.message);
    }
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

async function loadTestimonials() {
    try {
        const response = await fetch(`${API_BASE}/api/testimonials`);
        const testimonials = await response.json();
        const grid = document.getElementById('testimonials-grid');
        grid.innerHTML = testimonials.map(t => `
            <div class="testimonial-card">
                <div class="testimonial-stars">${'<i class="fas fa-star"></i>'.repeat(t.rating)}</div>
                <p class="testimonial-content">"${escapeHtml(t.content)}"</p>
                <div class="testimonial-author">
                    <img src="${escapeHtml(t.avatar || '/images/testimonial-1.jpg')}" alt="${escapeHtml(t.name)}" onerror="this.src='/images/testimonial-1.jpg'">
                    <div>
                        <strong>${escapeHtml(t.name)}</strong>
                        <span>${escapeHtml(t.role)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        renderTestimonialsAdmin(testimonials);
    } catch (error) {
        console.error('Error loading testimonials:', error);
    }
}

function renderTestimonialsAdmin(testimonials) {
    const list = document.getElementById('testimonials-list');
    if (!list) return;
    list.innerHTML = testimonials.map(t => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(t.name)}</h4>
                <p>${escapeHtml(t.role)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editTestimonial(${t.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteTestimonial(${t.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function showAddForm(type) {
    if (type === 'testimonial') {
        document.getElementById('testimonial-id').value = '';
        document.getElementById('testimonial-avatar').value = '';
        setImagePreview('testimonial-avatar-preview', '');
        document.getElementById('testimonial-form').style.display = 'block';
        return;
    }
    if (type === 'team-member') {
        document.getElementById('team-member-id').value = '';
        document.getElementById('team-member-image').value = '';
        setImagePreview('team-member-image-preview', '');
        document.getElementById('team-member-form').style.display = 'block';
        return;
    }
    if (type === 'career') {
        document.getElementById('career-id').value = '';
        document.getElementById('career-form').style.display = 'block';
        return;
    }
    const form = document.getElementById(`${type}-form`);
    form.style.display = 'block';
    if (type === 'project') {
        document.getElementById('project-id').value = '';
        document.getElementById('project-image').value = '';
        setImagePreview('project-image-preview', '');
    }
    else if (type === 'service') document.getElementById('service-id').value = '';
    else if (type === 'blog') document.getElementById('blog-id').value = '';
}

function hideForm(type) {
    if (type === 'testimonial') {
        document.getElementById('testimonial-form').style.display = 'none';
        return;
    }
    if (type === 'team-member') {
        document.getElementById('team-member-form').style.display = 'none';
        return;
    }
    if (type === 'career') {
        document.getElementById('career-form').style.display = 'none';
        return;
    }
    document.getElementById(`${type}-form`).style.display = 'none';
}

async function saveTestimonial(e) {
    e.preventDefault();
    const id = document.getElementById('testimonial-id').value;
    const data = {
        name: document.getElementById('testimonial-name').value,
        role: document.getElementById('testimonial-role').value,
        content: document.getElementById('testimonial-content').value,
        avatar: document.getElementById('testimonial-avatar').value,
        rating: parseInt(document.getElementById('testimonial-rating').value)
    };
    try {
        const response = await authFetch(`${API_BASE}/api/testimonials${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);
        hideForm('testimonial');
        e.target.reset();
        loadTestimonials();
    } catch (error) {
        console.error('Error saving testimonial:', error);
    }
}

async function editTestimonial(id) {
    const response = await fetch(`${API_BASE}/api/testimonials`);
    const items = await response.json();
    const item = items.find(t => t.id === id);
    if (item) {
        document.getElementById('testimonial-id').value = item.id;
        document.getElementById('testimonial-name').value = item.name;
        document.getElementById('testimonial-role').value = item.role;
        document.getElementById('testimonial-content').value = item.content;
        document.getElementById('testimonial-avatar').value = item.avatar || '';
        document.getElementById('testimonial-rating').value = item.rating;
        setImagePreview('testimonial-avatar-preview', item.avatar || '');
        document.getElementById('testimonial-form').style.display = 'block';
    }
}

async function deleteTestimonial(id) {
    if (confirm('Delete this testimonial?')) {
        const response = await authFetch(`${API_BASE}/api/testimonials/${id}`, { method: 'DELETE' });
        if (response.ok) loadTestimonials();
    }
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

async function loadTeam() {
    try {
        const response = await fetch(`${API_BASE}/api/team`);
        const team = await response.json();
        const grid = document.getElementById('team-grid');
        grid.innerHTML = team.map(m => `
            <div class="team-card">
                <div class="team-image">
                    <img src="${escapeHtml(m.image)}" alt="${escapeHtml(m.name)}" onerror="this.src='/images/team-1.jpg'">
                </div>
                <div class="team-info">
                    <h3>${escapeHtml(m.name)}</h3>
                    <span class="team-role">${escapeHtml(m.role)}</span>
                    <p>${escapeHtml(m.bio || '')}</p>
                    <div class="team-social">
                        ${m.social && m.social.twitter ? `<a href="${escapeHtml(m.social.twitter)}"><i class="fab fa-twitter"></i></a>` : ''}
                        ${m.social && m.social.linkedin ? `<a href="${escapeHtml(m.social.linkedin)}"><i class="fab fa-linkedin"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        renderTeamAdmin(team);
    } catch (error) {
        console.error('Error loading team:', error);
    }
}

function renderTeamAdmin(team) {
    const list = document.getElementById('team-list');
    if (!list) return;
    list.innerHTML = team.map(m => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(m.name)}</h4>
                <p>${escapeHtml(m.role)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editTeamMember(${m.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteTeamMember(${m.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function saveTeamMember(e) {
    e.preventDefault();
    const id = document.getElementById('team-member-id').value;
    const data = {
        name: document.getElementById('team-member-name').value,
        role: document.getElementById('team-member-role').value,
        bio: document.getElementById('team-member-bio').value,
        image: document.getElementById('team-member-image').value,
        social: { twitter: '#', linkedin: '#' }
    };
    try {
        const response = await authFetch(`${API_BASE}/api/team${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);
        hideForm('team-member');
        e.target.reset();
        loadTeam();
    } catch (error) {
        console.error('Error saving team member:', error);
    }
}

async function editTeamMember(id) {
    const response = await fetch(`${API_BASE}/api/team`);
    const items = await response.json();
    const item = items.find(m => m.id === id);
    if (item) {
        document.getElementById('team-member-id').value = item.id;
        document.getElementById('team-member-name').value = item.name;
        document.getElementById('team-member-role').value = item.role;
        document.getElementById('team-member-bio').value = item.bio || '';
        document.getElementById('team-member-image').value = item.image || '';
        setImagePreview('team-member-image-preview', item.image || '');
        document.getElementById('team-member-form').style.display = 'block';
    }
}

async function deleteTeamMember(id) {
    if (confirm('Delete this team member?')) {
        const response = await authFetch(`${API_BASE}/api/team/${id}`, { method: 'DELETE' });
        if (response.ok) loadTeam();
    }
}

// ---------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------

async function loadCareers() {
    try {
        const response = await fetch(`${API_BASE}/api/careers`);
        const jobs = await response.json();
        renderJobs(jobs);
        renderCareersAdmin(jobs);
    } catch (error) {
        console.error('Error loading careers:', error);
    }
}

function renderJobs(jobs) {
    const list = document.getElementById('jobs-list');
    const deptFilter = document.getElementById('job-department-filter').value;
    const typeFilter = document.getElementById('job-type-filter').value;

    jobs.forEach(j => { jobTitles[j.id] = j.title; });

    const filtered = jobs.filter(j => {
        if (j.status === 'closed') return false;
        if (deptFilter !== 'all' && j.department !== deptFilter) return false;
        if (typeFilter !== 'all' && j.type !== typeFilter) return false;
        return true;
    });
    if (filtered.length === 0) {
        list.innerHTML = '<p class="no-jobs">No open positions match your criteria.</p>';
        return;
    }
    list.innerHTML = filtered.map(j => `
        <div class="job-card">
            <div class="job-header">
                <h3>${escapeHtml(j.title)}</h3>
                <span class="job-badge ${escapeHtml(j.type.toLowerCase())}">${escapeHtml(j.type)}</span>
            </div>
            <div class="job-meta">
                <span><i class="fas fa-building"></i> ${escapeHtml(j.department)}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(j.location)}</span>
                <span><i class="fas fa-calendar"></i> Posted ${escapeHtml(j.posted)}</span>
            </div>
            <p class="job-description">${escapeHtml(j.description)}</p>
            ${j.requirements && j.requirements.length ? `
            <div class="job-requirements">
                <strong>Requirements:</strong>
                <ul>${j.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
            </div>` : ''}
            <button class="btn btn-primary" onclick="openApplyForm(${j.id})">Apply Now</button>
        </div>
    `).join('');
}

function filterJobs() {
    loadCareers();
}

function openApplyForm(jobId) {
    document.getElementById('apply-job-id').value = jobId;
    document.getElementById('apply-job-title').textContent = `Applying for: ${jobTitles[jobId] || 'Position'}`;
    document.getElementById('apply-section').style.display = 'block';
    document.getElementById('apply-section').scrollIntoView({ behavior: 'smooth' });
}

function closeApplyForm() {
    document.getElementById('apply-section').style.display = 'none';
    document.getElementById('apply-form').reset();
}

async function submitApplication(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.jobId = document.getElementById('apply-job-id').value;
    try {
        const response = await fetch(`${API_BASE}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('Application submitted successfully! We will be in touch.');
            closeApplyForm();
        } else {
            const err = await response.json().catch(() => ({}));
            alert(err.error || 'Failed to submit application. Please try again.');
        }
    } catch (error) {
        console.error('Error submitting application:', error);
        alert('Failed to submit application. Please try again.');
    }
}

function renderCareersAdmin(jobs) {
    const list = document.getElementById('careers-admin-list');
    if (!list) return;
    list.innerHTML = jobs.map(j => `
        <div class="admin-list-item">
            <div>
                <h4>${escapeHtml(j.title)}</h4>
                <p>${escapeHtml(j.department)} - ${escapeHtml(j.location)} <span class="status-badge ${escapeHtml(j.status)}">${escapeHtml(j.status)}</span></p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary" onclick="editCareer(${j.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteCareer(${j.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function saveCareer(e) {
    e.preventDefault();
    const id = document.getElementById('career-id').value;
    const reqs = document.getElementById('career-requirements').value.split('\n').filter(r => r.trim());
    const data = {
        title: document.getElementById('career-title').value,
        department: document.getElementById('career-department').value,
        location: document.getElementById('career-location').value,
        type: document.getElementById('career-type').value,
        description: document.getElementById('career-description').value,
        requirements: reqs,
        status: document.getElementById('career-status').value
    };
    try {
        const response = await authFetch(`${API_BASE}/api/careers${id ? '/' + id : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) return handleSaveError(response);
        hideForm('career');
        e.target.reset();
        loadCareers();
    } catch (error) {
        console.error('Error saving career:', error);
    }
}

async function editCareer(id) {
    const response = await fetch(`${API_BASE}/api/careers`);
    const items = await response.json();
    const item = items.find(c => c.id === id);
    if (item) {
        document.getElementById('career-id').value = item.id;
        document.getElementById('career-title').value = item.title;
        document.getElementById('career-department').value = item.department;
        document.getElementById('career-location').value = item.location;
        document.getElementById('career-type').value = item.type;
        document.getElementById('career-description').value = item.description;
        document.getElementById('career-requirements').value = (item.requirements || []).join('\n');
        document.getElementById('career-status').value = item.status;
        document.getElementById('career-form').style.display = 'block';
    }
}

async function deleteCareer(id) {
    if (confirm('Delete this job listing?')) {
        const response = await authFetch(`${API_BASE}/api/careers/${id}`, { method: 'DELETE' });
        if (response.ok) loadCareers();
    }
}

// ---------------------------------------------------------------------------
// Applications (admin only)
// ---------------------------------------------------------------------------

async function loadApplications() {
    try {
        const response = await authFetch(`${API_BASE}/api/applications`);
        if (!response.ok) return;
        const applications = await response.json();

        const jobsResponse = await fetch(`${API_BASE}/api/careers`);
        const jobs = await jobsResponse.json();
        const enriched = applications.map(a => ({
            ...a,
            jobTitle: (jobs.find(j => j.id == a.jobId) || {}).title
        }));

        renderApplicationsAdmin(enriched);
    } catch (error) {
        console.error('Error loading applications:', error);
    }
}

function renderApplicationsAdmin(applications) {
    const list = document.getElementById('applications-list');
    if (!list) return;
    if (applications.length === 0) {
        list.innerHTML = '<p class="no-jobs">No applications submitted yet.</p>';
        return;
    }
    list.innerHTML = applications.map(a => `
        <div class="admin-list-item app-item">
            <div>
                <h4>${escapeHtml(a.name)}</h4>
                <div class="app-item-meta">
                    <span><i class="fas fa-briefcase"></i> ${escapeHtml(a.jobTitle || 'Job #' + a.jobId)}</span>
                    <span><i class="fas fa-envelope"></i> ${escapeHtml(a.email)}</span>
                    ${a.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(a.phone)}</span>` : ''}
                    <span><i class="fas fa-calendar"></i> ${escapeHtml(a.date)}</span>
                </div>
                <p class="app-item-cover">${escapeHtml(a.coverLetter)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-danger" onclick="deleteApplication(${a.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteApplication(id) {
    if (confirm('Delete this application?')) {
        const response = await authFetch(`${API_BASE}/api/applications/${id}`, { method: 'DELETE' });
        if (response.ok) loadApplications();
    }
}

// ---------------------------------------------------------------------------
// Misc UI
// ---------------------------------------------------------------------------

function toggleFaq(element) {
    const item = element.parentElement;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
    if (!isActive) item.classList.add('active');
}

function initStatsCounter() {
    const counters = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.dataset.target);
                let current = 0;
                const increment = Math.ceil(target / 60);
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        counter.textContent = target + '+';
                        clearInterval(timer);
                    } else {
                        counter.textContent = current;
                    }
                }, 25);
                observer.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
}

function initContactForm() {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', submitContact);
}

async function submitContact(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_BASE}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.emailed
                ? 'Thank you! Your message has been sent.'
                : 'Thank you for your message! We will get back to you soon.');
            form.reset();
        } else {
            alert(result.error || 'Failed to send message. Please try again.');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ---------------------------------------------------------------------------
// Contact messages (admin only)
// ---------------------------------------------------------------------------

async function loadMessages() {
    try {
        const response = await authFetch(`${API_BASE}/api/messages`);
        if (!response.ok) return;
        const messages = await response.json();
        renderMessagesAdmin(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderMessagesAdmin(messages) {
    const list = document.getElementById('messages-list');
    if (!list) return;
    if (messages.length === 0) {
        list.innerHTML = '<p class="no-jobs">No messages received yet.</p>';
        return;
    }
    list.innerHTML = messages.map(m => `
        <div class="admin-list-item app-item">
            <div>
                <h4>${escapeHtml(m.name)}</h4>
                <div class="app-item-meta">
                    <span><i class="fas fa-envelope"></i> ${escapeHtml(m.email)}</span>
                    <span><i class="fas fa-calendar"></i> ${escapeHtml(formatDate(m.date))}</span>
                </div>
                ${m.subject ? `<p class="app-item-subject">${escapeHtml(m.subject)}</p>` : ''}
                <p class="app-item-cover">${escapeHtml(m.message)}</p>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-danger" onclick="deleteMessage(${m.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

async function deleteMessage(id) {
    if (confirm('Delete this message?')) {
        const response = await authFetch(`${API_BASE}/api/messages/${id}`, { method: 'DELETE' });
        if (response.ok) loadMessages();
    }
}

async function sendTestEmail() {
    try {
        const response = await authFetch(`${API_BASE}/api/contact/test`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            alert(`Test email sent to ${data.to}. Check your inbox (and spam folder).`);
        } else {
            alert(data.error || 'Failed to send test email.');
        }
    } catch (error) {
        console.error('Test email error:', error);
        alert('Failed to send test email.');
    }
}

async function handleSaveError(response) {
    try {
        const data = await response.json();
        alert(data.error || 'Failed to save. Please try again.');
    } catch (error) {
        alert('Failed to save. Please try again.');
    }
}
