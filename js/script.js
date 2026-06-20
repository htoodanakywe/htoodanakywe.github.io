// Wave text animation
function updateWaveText() {
    const waveText = document.querySelector('.wave-text');
    const text = t('hero.title');
    if (currentLang === 'my') {
        waveText.innerHTML = text.split(' ').map((word, i) => 
            `<span style="animation-delay: ${i * 0.1}s">${word}</span>`
        ).join(' ');
    } else {
        waveText.innerHTML = text.split('').map((char, i) => 
            `<span style="animation-delay: ${i * 0.05}s">${char === ' ' ? '&nbsp;' : char}</span>`
        ).join('');
    }
}

window.addEventListener('languageChanged', updateWaveText);
document.addEventListener('DOMContentLoaded', updateWaveText);

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

// Lightbox state object - manages all state for the image gallery lightbox
const lightboxState = {
    isOpen: false,                    // Whether lightbox is currently displayed
    currentProjectIndex: 0,           // Index of current project in projects array
    currentImageIndex: 0,             // Index of current image in project.images
    projects: [],                     // Normalized project data
    previousFocus: null,              // Element to restore focus to on close
    touchStartX: 0,                   // Touch gesture tracking
    touchEndX: 0                      // Touch gesture tracking
};

// Default placeholder shown when a project has no browser-displayable images
const DEFAULT_PROJECT_IMAGE = 'img/projects/projectdefault.JPG';

// How many project cards to show before the "View more projects" button
const PROJECTS_PER_PAGE = 6;

// Browsers cannot render HEIC/HEIF images, so treat those as non-displayable.
function isDisplayableImage(src) {
    return typeof src === 'string' && !/\.(heic|heif)\s*$/i.test(src.trim());
}

// Data normalization: accepts an images[] array or a single image, and drops
// formats browsers can't display (HEIC/HEIF). Falls back to a default image so
// every project always has at least one valid thumbnail.
function normalizeProjectData(project) {
    let rawImages = [];

    if (Array.isArray(project.images) && project.images.length > 0) {
        rawImages = project.images;
    } else if (project.image) {
        rawImages = [project.image];
    }

    const displayable = rawImages.filter(isDisplayableImage);

    return {
        ...project,
        images: displayable.length > 0 ? displayable : [DEFAULT_PROJECT_IMAGE]
    };
}

// Open lightbox function - initializes and displays the lightbox for a specific project
function openLightbox(projectIndex) {
    // 1. Validate project index parameter
    if (!lightboxState.projects || !Array.isArray(lightboxState.projects)) {
        console.error('Projects array is not initialized');
        return;
    }
    
    if (typeof projectIndex !== 'number' || isNaN(projectIndex)) {
        console.warn(`Invalid project index type: ${projectIndex}`);
        return;
    }
    
    if (projectIndex < 0 || projectIndex >= lightboxState.projects.length) {
        console.warn(`Invalid project index: ${projectIndex}. Valid range: 0-${lightboxState.projects.length - 1}`);
        return;
    }
    
    const project = lightboxState.projects[projectIndex];
    if (!project || !project.images || !Array.isArray(project.images) || project.images.length === 0) {
        console.error(`Project at index ${projectIndex} has no valid images`);
        return;
    }
    
    // 2. Initialize state
    lightboxState.isOpen = true;
    lightboxState.currentProjectIndex = projectIndex;
    lightboxState.currentImageIndex = 0;
    
    // 3. Store current focus element for restoration
    lightboxState.previousFocus = document.activeElement;
    
    // 4. Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    // 5. Render lightbox UI
    renderLightbox();
    
    // 6. Attach event listeners
    attachEventListeners();
    
    // 7. Set focus to lightbox container
    const lightboxContainer = document.querySelector('.lightbox-container');
    if (lightboxContainer) {
        lightboxContainer.focus();
    }
    
    // 8. Preload adjacent images now, then warm the rest of the gallery
    preloadAdjacentImages();
    preloadAllProjectImages();
}

// Close lightbox function - applies fade-out animation and cleans up
function closeLightbox() {
    // 1. Apply fade-out animation
    const lightbox = document.querySelector('.lightbox-overlay');
    if (!lightbox) {
        console.warn('closeLightbox called but no lightbox overlay found');
        return;
    }
    
    lightbox.classList.add('fade-out');
    
    // 2. Wait for animation (300ms), then cleanup
    setTimeout(() => {
        // Remove DOM elements
        lightbox.remove();
        
        // 3. Restore body scrolling
        document.body.style.overflow = '';
        
        // 4. Detach event listeners (to be implemented in task 6.2)
        detachEventListeners();
        
        // 5. Restore focus to previous element
        if (lightboxState.previousFocus) {
            lightboxState.previousFocus.focus();
        }
        
        // 6. Reset state
        lightboxState.isOpen = false;
    }, 300);
}

// Render lightbox function - creates and displays the complete lightbox DOM structure
function renderLightbox() {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Project image gallery');
    
    // Build complete DOM structure
    overlay.innerHTML = `
        <div class="lightbox-container" tabindex="-1">
            <button class="lightbox-close" aria-label="Close gallery">&times;</button>
            <div class="lightbox-content">
                <button class="lightbox-nav lightbox-prev" aria-label="Previous image">&#10094;</button>
                <div class="lightbox-image-container">
                    <img class="lightbox-image" src="" alt="" decoding="async" />
                    <div class="lightbox-loader" aria-live="polite">Loading...</div>
                </div>
                <button class="lightbox-nav lightbox-next" aria-label="Next image">&#10095;</button>
            </div>
            <div class="lightbox-counter" aria-live="polite">
                <span class="current-image">1</span> / <span class="total-images">1</span>
            </div>
        </div>
    `;
    
    // Append to document body
    document.body.appendChild(overlay);
    
    // Apply fade-in animation using requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        overlay.classList.add('fade-in');
    });
    
    // Update image and navigation visibility
    updateImage();
    updateNavigationVisibility();
}

// Event listeners registry - stores references for cleanup
let eventListeners = {};

// Focus trap function - keeps keyboard focus within lightbox controls
function trapFocus(e) {
    const lightboxContainer = document.querySelector('.lightbox-container');
    if (!lightboxContainer) return;
    
    // Get all focusable elements within the lightbox
    const focusableElements = lightboxContainer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    // If shift+tab on first element, move to last element
    if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
    }
    // If tab on last element, move to first element
    else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
    }
}

// Attach event listeners function - sets up all user interaction handlers for the lightbox
function attachEventListeners() {
    // 1. Close button click handler
    eventListeners.closeBtn = (e) => {
        e.stopPropagation();
        closeLightbox();
    };
    const closeBtn = document.querySelector('.lightbox-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', eventListeners.closeBtn);
    }
    
    // 2. Previous button click handler
    eventListeners.prevBtn = (e) => {
        e.stopPropagation();
        navigatePrevious();
    };
    const prevBtn = document.querySelector('.lightbox-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', eventListeners.prevBtn);
    }
    
    // 3. Next button click handler
    eventListeners.nextBtn = (e) => {
        e.stopPropagation();
        navigateNext();
    };
    const nextBtn = document.querySelector('.lightbox-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', eventListeners.nextBtn);
    }
    
    // 4. Click outside to close (overlay click)
    eventListeners.overlay = (e) => {
        if (e.target.classList.contains('lightbox-overlay')) {
            closeLightbox();
        }
    };
    const overlay = document.querySelector('.lightbox-overlay');
    if (overlay) {
        overlay.addEventListener('click', eventListeners.overlay);
    }
    
    // 5. Keyboard navigation (ArrowLeft, ArrowRight, Escape)
    eventListeners.keyboard = (e) => {
        switch(e.key) {
            case 'ArrowRight':
                e.preventDefault();
                navigateNext();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                navigatePrevious();
                break;
            case 'Escape':
                e.preventDefault();
                closeLightbox();
                break;
        }
    };
    document.addEventListener('keydown', eventListeners.keyboard);
    
    // 6. Focus trap - keeps keyboard focus within lightbox controls
    eventListeners.focusTrap = (e) => {
        if (e.key === 'Tab') {
            trapFocus(e);
        }
    };
    document.addEventListener('keydown', eventListeners.focusTrap);
    
    // 7. Touch gesture handlers (touchstart, touchend)
    const imageContainer = document.querySelector('.lightbox-image-container');
    if (imageContainer) {
        eventListeners.touchStart = (e) => {
            lightboxState.touchStartX = e.touches[0].clientX;
        };
        imageContainer.addEventListener('touchstart', eventListeners.touchStart);
        
        eventListeners.touchEnd = (e) => {
            lightboxState.touchEndX = e.changedTouches[0].clientX;
            handleSwipe();
        };
        imageContainer.addEventListener('touchend', eventListeners.touchEnd);
    }
}

// Detach event listeners function - removes all event listeners and cleans up references
function detachEventListeners() {
    // Remove all event listeners using stored references with optional chaining for safe removal
    document.querySelector('.lightbox-close')
        ?.removeEventListener('click', eventListeners.closeBtn);
    document.querySelector('.lightbox-prev')
        ?.removeEventListener('click', eventListeners.prevBtn);
    document.querySelector('.lightbox-next')
        ?.removeEventListener('click', eventListeners.nextBtn);
    document.querySelector('.lightbox-overlay')
        ?.removeEventListener('click', eventListeners.overlay);
    document.removeEventListener('keydown', eventListeners.keyboard);
    document.removeEventListener('keydown', eventListeners.focusTrap);
    
    // Remove touch gesture listeners
    const imageContainer = document.querySelector('.lightbox-image-container');
    imageContainer?.removeEventListener('touchstart', eventListeners.touchStart);
    imageContainer?.removeEventListener('touchend', eventListeners.touchEnd);
    
    // Clear eventListeners object
    eventListeners = {};
}

// Image preloading caches. imagePromises dedupes in-flight loads by URL so the
// same photo is never requested twice; imageCache holds fully-loaded Images.
const imageCache = new Map();      // url -> decoded HTMLImageElement
const imagePromises = new Map();   // url -> Promise<HTMLImageElement|null>

// Load (or reuse an in-flight load of) an image. Always resolves; on failure it
// resolves to null so callers and the preload queue never get stuck.
function loadImage(url) {
    if (!url || typeof url !== 'string') return Promise.resolve(null);
    if (imagePromises.has(url)) return imagePromises.get(url);

    const promise = new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            imageCache.set(url, img);
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });

    imagePromises.set(url, promise);
    return promise;
}

// Fire-and-forget preload helper
function preloadImage(url) {
    loadImage(url);
}

// Preload the images immediately around the current one (in parallel) so the
// very next click is instant.
function preloadAdjacentImages() {
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    if (!project || !Array.isArray(project.images)) return;

    const total = project.images.length;
    if (total <= 1) return;

    const i = lightboxState.currentImageIndex;
    preloadImage(project.images[(i + 1) % total]);          // next
    preloadImage(project.images[(i + 2) % total]);          // next + 1
    preloadImage(project.images[(i - 1 + total) % total]);  // previous
}

// Warm the rest of the gallery in the background, one image at a time so it
// doesn't steal bandwidth from the visible image. Walks forward from the
// current image, so by the time the user clicks through they're already cached.
function preloadAllProjectImages() {
    const projectIndex = lightboxState.currentProjectIndex;
    const project = lightboxState.projects[projectIndex];
    if (!project || !Array.isArray(project.images)) return;

    const images = project.images;
    const total = images.length;
    if (total <= 1) return;

    const start = lightboxState.currentImageIndex;
    let step = 1;

    const loadNext = () => {
        // Stop if the lightbox closed or a different project was opened
        if (!lightboxState.isOpen || lightboxState.currentProjectIndex !== projectIndex) return;
        if (step >= total) return;

        const url = images[(start + step) % total];
        step++;
        loadImage(url).then(loadNext);
    };

    loadNext();
}

// Navigate to next image function - handles forward navigation with wrapping
function navigateNext() {
    if (!lightboxState.isOpen) {
        console.warn('navigateNext called but lightbox is not open');
        return;
    }
    
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    
    if (!project || !project.images || !Array.isArray(project.images) || project.images.length === 0) {
        console.error('Invalid project data in navigateNext');
        return;
    }
    
    const totalImages = project.images.length;
    
    // Calculate next index with wrapping: (currentIndex + 1) % totalImages
    lightboxState.currentImageIndex = 
        (lightboxState.currentImageIndex + 1) % totalImages;
    
    // Update the displayed image
    updateImage();
    
    // Preload adjacent images for smooth navigation
    preloadAdjacentImages();
}

// Navigate to previous image function - handles backward navigation with wrapping
function navigatePrevious() {
    if (!lightboxState.isOpen) {
        console.warn('navigatePrevious called but lightbox is not open');
        return;
    }
    
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    
    if (!project || !project.images || !Array.isArray(project.images) || project.images.length === 0) {
        console.error('Invalid project data in navigatePrevious');
        return;
    }
    
    const totalImages = project.images.length;
    
    // Calculate previous index with wrapping: (currentIndex - 1 + totalImages) % totalImages
    lightboxState.currentImageIndex = 
        (lightboxState.currentImageIndex - 1 + totalImages) % totalImages;
    
    // Update the displayed image
    updateImage();
    
    // Preload adjacent images for smooth navigation
    preloadAdjacentImages();
}

// Handle swipe gesture function - processes touch gestures for navigation
function handleSwipe() {
    const swipeThreshold = 50; // minimum distance in pixels for swipe
    const diff = lightboxState.touchStartX - lightboxState.touchEndX;
    
    // Only navigate if swipe distance exceeds threshold
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swiped left (positive diff) - show next image
            navigateNext();
        } else {
            // Swiped right (negative diff) - show previous image
            navigatePrevious();
        }
    }
    // If swipe is below threshold, do nothing (prevents accidental navigation)
}

// Update image function - handles image loading, display, and counter updates
function updateImage() {
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    
    // Validate project and image data
    if (!project || !project.images || !Array.isArray(project.images)) {
        console.error('Invalid project data in updateImage');
        return;
    }
    
    if (lightboxState.currentImageIndex < 0 || lightboxState.currentImageIndex >= project.images.length) {
        console.error(`Invalid image index: ${lightboxState.currentImageIndex}`);
        return;
    }
    
    const imageUrl = project.images[lightboxState.currentImageIndex];
    
    const imgElement = document.querySelector('.lightbox-image');
    const loader = document.querySelector('.lightbox-loader');
    const counter = document.querySelector('.lightbox-counter');
    
    // Validate DOM elements exist
    if (!imgElement || !loader || !counter) {
        console.error('Required lightbox DOM elements not found');
        return;
    }
    
    // Capture which image this call is for, so a slow load that finishes after
    // the user has already clicked again can be safely ignored (no flicker).
    const requestIndex = lightboxState.currentImageIndex;
    const altText = `${project.title} - Image ${requestIndex + 1}`;

    const showImage = () => {
        imgElement.src = imageUrl;
        imgElement.alt = altText;
        loader.style.display = 'none';
        loader.style.color = '';
        imgElement.style.opacity = '1';
    };

    if (imageCache.has(imageUrl)) {
        // Already loaded -> show instantly, no "Loading..." flash
        showImage();
    } else {
        // Keep the previous image visible but dimmed for instant feedback, and
        // only reveal the loader text if the load is actually slow (> 200ms).
        imgElement.style.opacity = '0.35';
        const loaderTimer = setTimeout(() => {
            loader.style.display = 'block';
            loader.textContent = 'Loading...';
            loader.style.color = '';
        }, 200);

        loadImage(imageUrl).then((img) => {
            clearTimeout(loaderTimer);

            // Ignore if the user already navigated to a different image
            if (!lightboxState.isOpen || lightboxState.currentImageIndex !== requestIndex) return;

            if (img) {
                showImage();
            } else {
                loader.style.display = 'block';
                loader.textContent = 'Failed to load image';
                loader.style.color = '#ff6b6b';
                imgElement.style.opacity = '0';
            }
        });
    }
    
    // 5. Update counter display (current/total)
    const currentImageSpan = document.querySelector('.current-image');
    const totalImagesSpan = document.querySelector('.total-images');
    
    if (currentImageSpan && totalImagesSpan) {
        currentImageSpan.textContent = lightboxState.currentImageIndex + 1;
        totalImagesSpan.textContent = project.images.length;
    }
    
    // 6. Hide counter if only one image
    counter.style.display = project.images.length > 1 ? 'block' : 'none';
}

// Update navigation visibility function - shows/hides navigation buttons based on image count
function updateNavigationVisibility() {
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    
    // Validate project data
    if (!project || !project.images || !Array.isArray(project.images)) {
        console.error('Invalid project data in updateNavigationVisibility');
        return;
    }
    
    const hasMultipleImages = project.images.length > 1;
    
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    
    // Validate DOM elements exist
    if (!prevBtn || !nextBtn) {
        console.warn('Navigation buttons not found in DOM');
        return;
    }
    
    // Show navigation buttons only if project has multiple images
    prevBtn.style.display = hasMultipleImages ? 'block' : 'none';
    nextBtn.style.display = hasMultipleImages ? 'block' : 'none';
}

// ===== Modern UI behaviors: scroll reveal, counters, back-to-top, pagination =====
let revealObserver = null;

// Adds an element to the scroll-reveal system. Works for both static and
// dynamically created elements. If no observer exists (reduced motion or
// unsupported browser), the element is shown immediately.
function observeReveal(el) {
    if (!el) return;
    el.classList.add('reveal');
    if (revealObserver) {
        revealObserver.observe(el);
    } else {
        el.classList.add('in-view');
    }
}

function initScrollReveal() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && 'IntersectionObserver' in window) {
        revealObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    document.querySelectorAll('.section-title, .service-card, .about-card')
        .forEach(observeReveal);
}

// Counts up from 0 to the element's data-count, appending data-suffix (+, %).
function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            el.textContent = target + suffix;
        }
    }
    requestAnimationFrame(tick);
}

function initCounters() {
    const nums = document.querySelectorAll('.stat-num');
    if (!nums.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
        nums.forEach(el => {
            el.textContent = (el.dataset.count || '0') + (el.dataset.suffix || '');
        });
        return;
    }
    const obs = new IntersectionObserver((entries, o) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                o.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    nums.forEach(el => obs.observe(el));
}

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    const toggle = () => btn.classList.toggle('visible', window.scrollY > 500);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Wires up the "View more projects" button to reveal cards a page at a time.
function initLoadMore() {
    const btn = document.getElementById('load-more');
    if (!btn) return;
    const container = document.getElementById('projects-container');
    const remaining = () => container.querySelectorAll('.project-card.is-hidden');

    if (remaining().length === 0) {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = 'inline-block';

    btn.addEventListener('click', () => {
        const hidden = remaining();
        for (let i = 0; i < PROJECTS_PER_PAGE && i < hidden.length; i++) {
            hidden[i].classList.remove('is-hidden');
        }
        if (remaining().length === 0) {
            btn.style.display = 'none';
        }
    });
}

// Load projects from JSON
fetch('data/projects.json')
    .then(response => response.json())
    .then(projects => {
        const container = document.getElementById('projects-container');
        // Normalize all project data for backward compatibility and store in state
        lightboxState.projects = projects.map(normalizeProjectData);
        
        lightboxState.projects.forEach((project, index) => {
            const card = document.createElement('div');
            card.className = 'project-card';

            // Only the first page of projects shows initially; the rest are
            // revealed by the "View more projects" button.
            if (index >= PROJECTS_PER_PAGE) {
                card.classList.add('is-hidden');
            }

            // Image container keeps the aspect ratio and shows a gradient
            // placeholder while the photo loads.
            const imgBox = document.createElement('div');
            imgBox.className = 'project-img';

            // Lazy-loaded thumbnail: the browser only fetches it when it scrolls
            // near the viewport, which greatly reduces initial page load time.
            const thumb = document.createElement('img');
            thumb.src = project.images[0];
            thumb.alt = project.title;
            thumb.loading = 'lazy';
            thumb.decoding = 'async';
            thumb.addEventListener('load', () => thumb.classList.add('loaded'), { once: true });
            thumb.addEventListener('error', () => {
                // Fall back to the default image if the thumbnail fails to load
                if (!thumb.src.endsWith(DEFAULT_PROJECT_IMAGE)) {
                    thumb.src = DEFAULT_PROJECT_IMAGE;
                }
                thumb.classList.add('loaded');
            }, { once: true });
            imgBox.appendChild(thumb);

            const title = document.createElement('h3');
            title.textContent = project.title;

            const details = document.createElement('p');
            details.textContent = project.details;

            card.appendChild(imgBox);
            card.appendChild(title);
            card.appendChild(details);

            // Open the lightbox gallery on click
            imgBox.addEventListener('click', () => {
                openLightbox(index);
            });

            // Keyboard accessibility
            imgBox.setAttribute('tabindex', '0');
            imgBox.setAttribute('role', 'button');
            imgBox.setAttribute('aria-label', `View ${project.title} gallery`);
            imgBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(index);
                }
            });

            observeReveal(card);
            container.appendChild(card);
        });

        // Set up the "View more projects" pagination button
        initLoadMore();
    });

// Load testimonials from JSON
fetch('data/testimonials.json')
    .then(response => response.json())
    .then(testimonials => {
        const container = document.getElementById('testimonials-container');
        testimonials.forEach(testimonial => {
            const card = document.createElement('div');
            card.className = 'testimonial-card';
            const rating = Math.max(0, Math.min(5, testimonial.rating || 5));
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            card.innerHTML = `
                <div class="testimonial-stars" aria-label="${rating} out of 5 stars">${stars}</div>
                <p>"${testimonial.quote}"</p>
                <h4>- ${testimonial.author}</h4>
            `;
            observeReveal(card);
            container.appendChild(card);
        });
    });

// Form submission
document.querySelector('.contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert(t('contact.successMsg'));
    e.target.reset();
});


// ===== Initialize modern UI behaviors =====
// Render Lucide SVG icons (replaces the <i data-lucide> placeholders)
if (window.lucide && typeof window.lucide.createIcons === 'function') {
    lucide.createIcons();
}

initScrollReveal();
initCounters();
initBackToTop();
