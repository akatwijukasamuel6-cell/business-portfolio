const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const initDataFile = (filename, defaultData) => {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
    return filePath;
};

const readData = (filename) => {
    const filePath = path.join(dataDir, filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

const writeData = (filename, data) => {
    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

initDataFile('projects.json', [
    { id: 1, title: 'E-Commerce Platform', description: 'A full-featured online store with payment integration, inventory management, and analytics dashboard.', image: '/images/project-1.jpg', category: 'Web Development', link: '#' },
    { id: 2, title: 'Fitness Tracker App', description: 'Mobile app for tracking workouts, nutrition, and health metrics with social features.', image: '/images/project-2.jpg', category: 'Mobile App', link: '#' },
    { id: 3, title: 'Task Management System', description: 'Collaborative project management tool with real-time updates and team analytics.', image: '/images/project-3.jpg', category: 'SaaS', link: '#' }
]);

initDataFile('blog.json', [
    { id: 1, title: 'Getting Started with Web Development', content: 'Web development is an exciting journey...', date: '2026-01-15', author: 'Admin' },
    { id: 2, title: 'Best Practices for Modern Websites', content: 'Creating a modern website requires...', date: '2026-02-01', author: 'Admin' },
    { id: 3, title: 'The Future of Digital Marketing', content: 'Digital marketing continues to evolve...', date: '2026-02-20', author: 'Admin' }
]);

initDataFile('services.json', [
    { id: 1, title: 'Web Development', description: 'Custom websites and web applications tailored to your needs', icon: 'code' },
    { id: 2, title: 'UI/UX Design', description: 'Beautiful and intuitive user interfaces that engage users', icon: 'paint-brush' },
    { id: 3, title: 'Digital Marketing', description: 'Strategic marketing to grow your online presence', icon: 'chart-line' },
    { id: 4, title: 'Consulting', description: 'Expert advice to help your business succeed online', icon: 'comments' }
]);

initDataFile('testimonials.json', [
    { id: 1, name: 'Sarah Johnson', role: 'CEO, TechStart', content: 'Working with this team was an incredible experience. They delivered beyond our expectations.', avatar: '/images/testimonial-1.jpg', rating: 5 },
    { id: 2, name: 'Michael Chen', role: 'Founder, DesignLab', content: 'Professional, creative, and highly skilled. They transformed our online presence completely.', avatar: '/images/testimonial-2.jpg', rating: 5 },
    { id: 3, name: 'Emily Rodriguez', role: 'CTO, CloudNine', content: 'The best investment we made for our business. Their solutions are innovative and scalable.', avatar: '/images/testimonial-3.jpg', rating: 5 }
]);

initDataFile('team.json', [
    { id: 1, name: 'John Smith', role: 'CEO & Founder', bio: 'Visionary leader with 15+ years in tech industry.', image: '/images/team-1.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 2, name: 'Lisa Wang', role: 'CTO', bio: 'Full-stack expert specializing in scalable architectures.', image: '/images/team-2.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 3, name: 'David Kim', role: 'Design Director', bio: 'Award-winning designer with a passion for UX.', image: '/images/team-3.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 4, name: 'Anna Petrova', role: 'Marketing Lead', bio: 'Digital marketing strategist driving brand growth.', image: '/images/team-4.jpg', social: { twitter: '#', linkedin: '#' } }
]);

initDataFile('careers.json', [
    { id: 1, title: 'Senior Frontend Developer', department: 'Engineering', location: 'Remote', type: 'Full-time', description: 'We are looking for an experienced frontend developer to join our team and build modern web applications.', requirements: ['5+ years React experience', 'TypeScript proficiency', 'UI/UX sensibility'], posted: '2026-03-01', status: 'open' },
    { id: 2, title: 'Backend Engineer', department: 'Engineering', location: 'San Francisco, CA', type: 'Full-time', description: 'Help us build scalable backend systems that power our platform.', requirements: ['Node.js expertise', 'Database design', 'API development'], posted: '2026-03-05', status: 'open' },
    { id: 3, title: 'UI/UX Designer', department: 'Design', location: 'Remote', type: 'Contract', description: 'Design beautiful and intuitive interfaces for our clients.', requirements: ['Figma proficiency', 'Design systems', 'User research'], posted: '2026-03-10', status: 'open' }
]);

initDataFile('applications.json', []);

initDataFile('pages.json', {
    about: {
        title: 'About Us',
        content: 'We are a dedicated team of professionals committed to delivering excellence in every project we undertake. With years of experience in web development, design, and digital marketing, we help businesses transform their digital presence.',
        mission: 'To empower businesses with innovative digital solutions that drive growth and success.',
        vision: 'To be the leading provider of digital transformation solutions worldwide.'
    },
    contact: {
        email: 'contact@business.com',
        phone: '+1 234 567 890',
        address: '123 Business Street, Tech City, TC 12345',
        social: {
            twitter: '#',
            linkedin: '#',
            github: '#'
        }
    }
});

app.get('/api/projects', (req, res) => {
    try {
        const projects = readData('projects.json');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const projects = readData('projects.json');
        const newProject = { id: Date.now(), ...req.body };
        projects.push(newProject);
        writeData('projects.json', projects);
        res.json(newProject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create project' });
    }
});

app.put('/api/projects/:id', (req, res) => {
    try {
        const projects = readData('projects.json');
        const index = projects.findIndex(p => p.id == req.params.id);
        if (index !== -1) {
            projects[index] = { ...projects[index], ...req.body };
            writeData('projects.json', projects);
            res.json(projects[index]);
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        let projects = readData('projects.json');
        projects = projects.filter(p => p.id != req.params.id);
        writeData('projects.json', projects);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

app.get('/api/blog', (req, res) => {
    try {
        const blog = readData('blog.json');
        res.json(blog);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

app.post('/api/blog', (req, res) => {
    try {
        const blog = readData('blog.json');
        const newPost = { id: Date.now(), date: new Date().toISOString().split('T')[0], ...req.body };
        blog.unshift(newPost);
        writeData('blog.json', blog);
        res.json(newPost);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});

app.put('/api/blog/:id', (req, res) => {
    try {
        const blog = readData('blog.json');
        const index = blog.findIndex(b => b.id == req.params.id);
        if (index !== -1) {
            blog[index] = { ...blog[index], ...req.body };
            writeData('blog.json', blog);
            res.json(blog[index]);
        } else {
            res.status(404).json({ error: 'Blog post not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update blog post' });
    }
});

app.delete('/api/blog/:id', (req, res) => {
    try {
        let blog = readData('blog.json');
        blog = blog.filter(b => b.id != req.params.id);
        writeData('blog.json', blog);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});

app.get('/api/services', (req, res) => {
    try {
        const services = readData('services.json');
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

app.post('/api/services', (req, res) => {
    try {
        const services = readData('services.json');
        const newService = { id: Date.now(), ...req.body };
        services.push(newService);
        writeData('services.json', services);
        res.json(newService);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create service' });
    }
});

app.put('/api/services/:id', (req, res) => {
    try {
        const services = readData('services.json');
        const index = services.findIndex(s => s.id == req.params.id);
        if (index !== -1) {
            services[index] = { ...services[index], ...req.body };
            writeData('services.json', services);
            res.json(services[index]);
        } else {
            res.status(404).json({ error: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update service' });
    }
});

app.delete('/api/services/:id', (req, res) => {
    try {
        let services = readData('services.json');
        services = services.filter(s => s.id != req.params.id);
        writeData('services.json', services);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete service' });
    }
});

app.get('/api/pages/:page', (req, res) => {
    try {
        const pages = readData('pages.json');
        const page = pages[req.params.page];
        if (page) {
            res.json(page);
        } else {
            res.status(404).json({ error: 'Page not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch page data' });
    }
});

app.put('/api/pages/:page', (req, res) => {
    try {
        const pages = readData('pages.json');
        const existingData = pages[req.params.page] || {};
        pages[req.params.page] = { ...existingData, ...req.body };
        if (req.params.page === 'contact' && existingData.social) {
            pages[req.params.page].social = existingData.social;
        }
        writeData('pages.json', pages);
        res.json(pages[req.params.page]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update page data' });
    }
});

// Testimonials API
app.get('/api/testimonials', (req, res) => {
    try {
        const testimonials = readData('testimonials.json');
        res.json(testimonials);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
});

app.post('/api/testimonials', (req, res) => {
    try {
        const testimonials = readData('testimonials.json');
        const newItem = { id: Date.now(), ...req.body };
        testimonials.push(newItem);
        writeData('testimonials.json', testimonials);
        res.json(newItem);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create testimonial' });
    }
});

app.put('/api/testimonials/:id', (req, res) => {
    try {
        const testimonials = readData('testimonials.json');
        const index = testimonials.findIndex(t => t.id == req.params.id);
        if (index !== -1) {
            testimonials[index] = { ...testimonials[index], ...req.body };
            writeData('testimonials.json', testimonials);
            res.json(testimonials[index]);
        } else {
            res.status(404).json({ error: 'Testimonial not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update testimonial' });
    }
});

app.delete('/api/testimonials/:id', (req, res) => {
    try {
        let testimonials = readData('testimonials.json');
        testimonials = testimonials.filter(t => t.id != req.params.id);
        writeData('testimonials.json', testimonials);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete testimonial' });
    }
});

// Team API
app.get('/api/team', (req, res) => {
    try {
        const team = readData('team.json');
        res.json(team);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

app.post('/api/team', (req, res) => {
    try {
        const team = readData('team.json');
        const newMember = { id: Date.now(), ...req.body };
        team.push(newMember);
        writeData('team.json', team);
        res.json(newMember);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create team member' });
    }
});

app.put('/api/team/:id', (req, res) => {
    try {
        const team = readData('team.json');
        const index = team.findIndex(m => m.id == req.params.id);
        if (index !== -1) {
            team[index] = { ...team[index], ...req.body };
            writeData('team.json', team);
            res.json(team[index]);
        } else {
            res.status(404).json({ error: 'Team member not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update team member' });
    }
});

app.delete('/api/team/:id', (req, res) => {
    try {
        let team = readData('team.json');
        team = team.filter(m => m.id != req.params.id);
        writeData('team.json', team);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});

// Careers API
app.get('/api/careers', (req, res) => {
    try {
        const careers = readData('careers.json');
        res.json(careers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch careers' });
    }
});

app.post('/api/careers', (req, res) => {
    try {
        const careers = readData('careers.json');
        const newJob = { id: Date.now(), posted: new Date().toISOString().split('T')[0], status: 'open', ...req.body };
        careers.push(newJob);
        writeData('careers.json', careers);
        res.json(newJob);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create job' });
    }
});

app.put('/api/careers/:id', (req, res) => {
    try {
        const careers = readData('careers.json');
        const index = careers.findIndex(c => c.id == req.params.id);
        if (index !== -1) {
            careers[index] = { ...careers[index], ...req.body };
            writeData('careers.json', careers);
            res.json(careers[index]);
        } else {
            res.status(404).json({ error: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update job' });
    }
});

app.delete('/api/careers/:id', (req, res) => {
    try {
        let careers = readData('careers.json');
        careers = careers.filter(c => c.id != req.params.id);
        writeData('careers.json', careers);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// Job Applications API
app.post('/api/applications', (req, res) => {
    try {
        const applications = readData('applications.json');
        const newApp = { id: Date.now(), date: new Date().toISOString().split('T')[0], ...req.body };
        applications.push(newApp);
        writeData('applications.json', applications);
        res.json(newApp);
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit application' });
    }
});

app.get('/api/applications', (req, res) => {
    try {
        const applications = readData('applications.json');
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

app.delete('/api/applications/:id', (req, res) => {
    try {
        let applications = readData('applications.json');
        applications = applications.filter(a => a.id != req.params.id);
        writeData('applications.json', applications);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
