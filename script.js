// Wave text animation
const waveText = document.querySelector('.wave-text');
const text = 'Building Dreams, Creating Spaces';
waveText.innerHTML = text.split('').map((char, i) => 
    `<span style="animation-delay: ${i * 0.05}s">${char === ' ' ? '&nbsp;' : char}</span>`
).join('');

// Mobile menu toggle
const burger = document.querySelector('.burger');
const navLinks = document.querySelector('.nav-links');

burger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    burger.classList.toggle('active');
});

// Close menu when clicking on a link
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        burger.classList.remove('active');
    });
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    });
});

// Load projects from JSON
fetch('projects.json')
    .then(response => response.json())
    .then(projects => {
        const container = document.getElementById('projects-container');
        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            const imgUrl = project.image || 'img/projects/projectdefault.JPG';
            card.innerHTML = `
                <div class="project-img" style="background-image: url('${imgUrl}')"></div>
                <h3>${project.title}</h3>
                <p>${project.details}</p>
            `;
            container.appendChild(card);
        });
    });

// Load testimonials from JSON
fetch('testimonials.json')
    .then(response => response.json())
    .then(testimonials => {
        const container = document.getElementById('testimonials-container');
        testimonials.forEach(testimonial => {
            const card = document.createElement('div');
            card.className = 'testimonial-card';
            card.innerHTML = `
                <p>"${testimonial.quote}"</p>
                <h4>- ${testimonial.author}</h4>
            `;
            container.appendChild(card);
        });
    });

// Form submission
document.querySelector('.contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thank you for your message! We will contact you soon.');
    e.target.reset();
});
