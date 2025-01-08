export default defineNuxtPlugin(() => {
    // Create preloader container
    const preloader = document.createElement('div');
    preloader.id = 'global-preloader';
    preloader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: black;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

    // Create spinner inside preloader
    const spinner = document.createElement('div');
    spinner.style.cssText = `
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
  `;
    preloader.appendChild(spinner);
    document.body.appendChild(preloader);

    // Function to remove the preloader
    const removePreloader = () => {
        if (preloader) {
            preloader.style.opacity = '0'; // Smooth fade-out
            setTimeout(() => {
                if (preloader.parentNode) {
                    preloader.remove(); // Remove from DOM
                }
            }, 300); // Matches fade-out duration
        }
    };

    // Use Nuxt's ready event to detect hydration completion
    const app = useNuxtApp();
    app.hook('app:mounted', () => {
        removePreloader(); // Remove preloader once Nuxt app is mounted
    });

    // Fallback: Remove preloader on window load (for extra safety)
    window.addEventListener('load', removePreloader);
});
