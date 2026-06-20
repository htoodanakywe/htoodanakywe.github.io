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
    
    // 8. Preload adjacent images
    preloadAdjacentImages();
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
                    <img class="lightbox-image" src="" alt="" />
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

// Image cache for preloading
const imageCache = new Map();

function preloadImage(url) {
    // Validate URL
    if (!url || typeof url !== 'string') {
        console.warn('Invalid URL provided to preloadImage:', url);
        return;
    }
    
    // Skip if already cached
    if (imageCache.has(url)) return;
    
    const img = new Image();
    img.onload = () => {
        imageCache.set(url, img);
    };
    img.onerror = () => {
        // Silently fail for preloading - don't cache failed images
        console.debug(`Failed to preload image: ${url}`);
    };
    img.src = url;
}

function preloadAdjacentImages() {
    const project = lightboxState.projects[lightboxState.currentProjectIndex];
    
    // Validate project data
    if (!project || !project.images || !Array.isArray(project.images)) {
        console.warn('Invalid project data in preloadAdjacentImages');
        return;
    }
    
    const totalImages = project.images.length;
    
    // Skip preloading for single-image projects
    if (totalImages <= 1) return;
    
    const currentIndex = lightboxState.currentImageIndex;
    
    // Calculate adjacent indices with wrapping
    const nextIndex = (currentIndex + 1) % totalImages;
    const prevIndex = (currentIndex - 1 + totalImages) % totalImages;
    
    // Preload next and previous images
    preloadImage(project.images[nextIndex]);
    preloadImage(project.images[prevIndex]);
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
    
    // 1. Show loading indicator and hide image
    loader.style.display = 'block';
    loader.textContent = 'Loading...';
    loader.style.color = '';
    imgElement.style.opacity = '0';
    
    // 2. Create new Image object for preloading
    const newImg = new Image();
    
    // 3. Handle image.onload event
    newImg.onload = () => {
        // Display image with project title and image number
        imgElement.src = imageUrl;
        imgElement.alt = `${project.title} - Image ${lightboxState.currentImageIndex + 1}`;
        
        // Hide loader and apply fade-in
        loader.style.display = 'none';
        imgElement.style.opacity = '1';
    };
    
    // 4. Handle image.onerror event - navigation still works after error
    newImg.onerror = () => {
        // Show error message and keep image hidden
        loader.textContent = 'Failed to load image';
        loader.style.color = '#ff6b6b';
        imgElement.style.opacity = '0';
        // Note: Navigation buttons remain functional, allowing user to try other images
    };
    
    // Start loading the image
    newImg.src = imageUrl;
    
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

            container.appendChild(card);
        });
    });

// Load testimonials from JSON
fetch('data/testimonials.json')
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
    alert(t('contact.successMsg'));
    e.target.reset();
});
