const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    initAdminTabs();
    initContactForm();
});

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
    
    if (window.innerWidth <= 768) {
        document.querySelector('.nav-links').classList.remove('active');
    }
}

function toggleMobileMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
}

function testClick() {
    alert('Click works!');
}

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
        
        document.getElementById('about-content').innerHTML = `<p>${data.content}</p>`;
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
                <i class="fas fa-${service.icon}"></i>
                <h3>${service.title}</h3>
                <p>${service.description}</p>
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
            <div class="portfolio-item" data-category="${project.category}">
                <img src="${project.image}" alt="${project.title}" onerror="this.src='/images/project-1.jpg'">
                <div class="portfolio-item-content">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <span class="category">${project.category}</span>
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
                    <div class="date">${post.date}</div>
                    <h3>${post.title}</h3>
                    <p>${post.content.substring(0, 150)}...</p>
                    <span class="author">By ${post.author}</span>
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
                <span>${data.email}</span>
            </div>
            <div class="contact-item">
                <i class="fas fa-phone"></i>
                <span>${data.phone}</span>
            </div>
            <div class="contact-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${data.address}</span>
            </div>
            <div class="social-links">
                <a href="${data.social.twitter}"><i class="fab fa-twitter"></i></a>
                <a href="${data.social.linkedin}"><i class="fab fa-linkedin"></i></a>
                <a href="${data.social.github}"><i class="fab fa-github"></i></a>
            </div>
        `;

        document.getElementById('contact-email').value = data.email;
        document.getElementById('contact-phone').value = data.phone;
        document.getElementById('contact-address').value = data.address;
    } catch (error) {
        console.error('Error loading contact:', error);
    }
}

function renderProjectsAdmin(projects) {
    const list = document.getElementById('projects-list');
    list.innerHTML = projects.map(project => `
        <div class="admin-list-item">
            <div>
                <h4>${project.title}</h4>
                <p>${project.category}</p>
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
                <h4>${service.title}</h4>
                <p>${service.description.substring(0, 50)}...</p>
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
                <h4>${post.title}</h4>
                <p>${post.date} - ${post.author}</p>
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
        });
    });
}

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
        if (id) {
            await fetch(`${API_BASE}/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        hideForm('project');
        e.target.reset();
        loadProjects();
    } catch (error) {
        console.error('Error saving project:', error);
    }
}

async function editProject(id) {
    console.log('editProject called with id:', id);
    try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const projects = await response.json();
        console.log('Projects:', projects);
        const project = projects.find(p => p.id == id);
        console.log('Found project:', project);
        
        if (project) {
            document.getElementById('project-id').value = project.id;
            document.getElementById('project-title').value = project.title;
            document.getElementById('project-description').value = project.description;
            document.getElementById('project-image').value = project.image;
            document.getElementById('project-category').value = project.category;
            document.getElementById('project-link').value = project.link;
            
            document.getElementById('project-form').style.display = 'block';
        } else {
            console.log('Project not found');
        }
    } catch (error) {
        console.error('Error editing project:', error);
    }
}

async function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project?')) {
        try {
            await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
            loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    }
}

async function saveService(e) {
    e.preventDefault();
    
    const id = document.getElementById('service-id').value;
    const data = {
        title: document.getElementById('service-title').value,
        description: document.getElementById('service-description').value,
        icon: document.getElementById('service-icon').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/api/services/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
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
            await fetch(`${API_BASE}/api/services/${id}`, { method: 'DELETE' });
            loadServices();
        } catch (error) {
            console.error('Error deleting service:', error);
        }
    }
}

async function saveBlog(e) {
    e.preventDefault();
    
    const id = document.getElementById('blog-id').value;
    const data = {
        title: document.getElementById('blog-title').value,
        content: document.getElementById('blog-content').value,
        author: document.getElementById('blog-author').value
    };

    try {
        if (id) {
            await fetch(`${API_BASE}/api/blog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/blog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
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
            await fetch(`${API_BASE}/api/blog/${id}`, { method: 'DELETE' });
            loadBlog();
        } catch (error) {
            console.error('Error deleting blog post:', error);
        }
    }
}

async function saveAbout(e) {
    e.preventDefault();
    
    const data = {
        content: document.getElementById('about-content-editor').value,
        mission: document.getElementById('about-mission').value,
        vision: document.getElementById('about-vision').value
    };

    try {
        await fetch(`${API_BASE}/api/pages/about`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
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

    console.log('Saving contact:', data);
    
    try {
        const response = await fetch(`${API_BASE}/api/pages/contact`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            alert('Contact page saved successfully!');
            loadContact();
        } else {
            alert('Failed to save contact information');
        }
    } catch (error) {
        console.error('Error saving contact:', error);
        alert('Error saving contact: ' + error.message);
    }
}

async function loadTestimonials() {
    try {
        const response = await fetch(`${API_BASE}/api/testimonials`);
        const testimonials = await response.json();
        const grid = document.getElementById('testimonials-grid');
        grid.innerHTML = testimonials.map(t => `
            <div class="testimonial-card">
                <div class="testimonial-stars">${'<i class="fas fa-star"></i>'.repeat(t.rating)}</div>
                <p class="testimonial-content">"${t.content}"</p>
                <div class="testimonial-author">
                    <img src="${t.avatar || '/images/testimonial-1.jpg'}" alt="${t.name}" onerror="this.src='/images/testimonial-1.jpg'">
                    <div>
                        <strong>${t.name}</strong>
                        <span>${t.role}</span>
                    </div>
                </div>
            </div>
        `).join('');
        renderTestimonialsAdmin(testimonials);
    } catch (error) {
        console.error('Error loading testimonials:', error);
    }
}

async function loadTeam() {
    try {
        const response = await fetch(`${API_BASE}/api/team`);
        const team = await response.json();
        const grid = document.getElementById('team-grid');
        grid.innerHTML = team.map(m => `
            <div class="team-card">
                <div class="team-image">
                    <img src="${m.image}" alt="${m.name}" onerror="this.src='/images/team-1.jpg'">
                </div>
                <div class="team-info">
                    <h3>${m.name}</h3>
                    <span class="team-role">${m.role}</span>
                    <p>${m.bio || ''}</p>
                    <div class="team-social">
                        ${m.social && m.social.twitter ? `<a href="${m.social.twitter}"><i class="fab fa-twitter"></i></a>` : ''}
                        ${m.social && m.social.linkedin ? `<a href="${m.social.linkedin}"><i class="fab fa-linkedin"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        renderTeamAdmin(team);
    } catch (error) {
        console.error('Error loading team:', error);
    }
}

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
                <h3>${j.title}</h3>
                <span class="job-badge ${j.type.toLowerCase()}">${j.type}</span>
            </div>
            <div class="job-meta">
                <span><i class="fas fa-building"></i> ${j.department}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${j.location}</span>
                <span><i class="fas fa-calendar"></i> Posted ${j.posted}</span>
            </div>
            <p class="job-description">${j.description}</p>
            ${j.requirements ? `
            <div class="job-requirements">
                <strong>Requirements:</strong>
                <ul>${j.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>` : ''}
            <button class="btn btn-primary" onclick="openApplyForm(${j.id}, '${j.title.replace(/'/g, "\\'")}')">Apply Now</button>
        </div>
    `).join('');
}

function filterJobs() {
    loadCareers();
}

function openApplyForm(jobId, jobTitle) {
    document.getElementById('apply-job-id').value = jobId;
    document.getElementById('apply-job-title').textContent = `Applying for: ${jobTitle}`;
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
        await fetch(`${API_BASE}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        alert('Application submitted successfully! We will be in touch.');
        closeApplyForm();
    } catch (error) {
        console.error('Error submitting application:', error);
        alert('Failed to submit application. Please try again.');
    }
}

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

// --- Testimonials Admin ---

function renderTestimonialsAdmin(testimonials) {
    const list = document.getElementById('testimonials-list');
    if (!list) return;
    list.innerHTML = testimonials.map(t => `
        <div class="admin-list-item">
            <div>
                <h4>${t.name}</h4>
                <p>${t.role}</p>
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
        document.getElementById('testimonial-form').style.display = 'block';
        return;
    }
    if (type === 'team-member') {
        document.getElementById('team-member-id').value = '';
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
    if (type === 'project') document.getElementById('project-id').value = '';
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
        if (id) {
            await fetch(`${API_BASE}/api/testimonials/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/testimonials`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        }
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
        document.getElementById('testimonial-form').style.display = 'block';
    }
}

async function deleteTestimonial(id) {
    if (confirm('Delete this testimonial?')) {
        await fetch(`${API_BASE}/api/testimonials/${id}`, { method: 'DELETE' });
        loadTestimonials();
    }
}

// --- Team Admin ---

function renderTeamAdmin(team) {
    const list = document.getElementById('team-list');
    if (!list) return;
    list.innerHTML = team.map(m => `
        <div class="admin-list-item">
            <div>
                <h4>${m.name}</h4>
                <p>${m.role}</p>
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
        if (id) {
            await fetch(`${API_BASE}/api/team/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/team`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        }
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
        document.getElementById('team-member-form').style.display = 'block';
    }
}

async function deleteTeamMember(id) {
    if (confirm('Delete this team member?')) {
        await fetch(`${API_BASE}/api/team/${id}`, { method: 'DELETE' });
        loadTeam();
    }
}

// --- Careers Admin ---

function renderCareersAdmin(jobs) {
    const list = document.getElementById('careers-admin-list');
    if (!list) return;
    list.innerHTML = jobs.map(j => `
        <div class="admin-list-item">
            <div>
                <h4>${j.title}</h4>
                <p>${j.department} - ${j.location} <span class="status-badge ${j.status}">${j.status}</span></p>
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
        if (id) {
            await fetch(`${API_BASE}/api/careers/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/api/careers`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
        }
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
        await fetch(`${API_BASE}/api/careers/${id}`, { method: 'DELETE' });
        loadCareers();
    }
}

function initContactForm() {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        alert('Thank you for your message! We will get back to you soon.');
        form.reset();
    });
}
