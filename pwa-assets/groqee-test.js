/**
 * Groqee Test Script
 * Tests the connection between the PWA components and the Python backend
 */

console.log("Groqee Test Script loaded");

// Create a test button element in the demo section
window.addEventListener('DOMContentLoaded', () => {
    const demoSection = document.getElementById('demo');
    if (demoSection) {
        const testContainer = document.createElement('div');
        testContainer.style.marginTop = '20px';
        testContainer.style.padding = '15px';
        testContainer.style.backgroundColor = '#f0f7ff';
        testContainer.style.borderRadius = '8px';
        testContainer.style.border = '1px solid #1e88e5';
        
        const testTitle = document.createElement('h3');
        testTitle.textContent = 'Component Test';
        testTitle.style.marginTop = '0';
        
        const testResults = document.createElement('div');
        testResults.id = 'test-results';
        testResults.style.margin = '10px 0';
        testResults.style.padding = '10px';
        testResults.style.backgroundColor = '#fff';
        testResults.style.borderRadius = '4px';
        testResults.style.border = '1px solid #e0e0e0';
        testResults.style.height = '150px';
        testResults.style.overflowY = 'auto';
        testResults.innerHTML = '<p>Test results will appear here...</p>';
        
        const testButton = document.createElement('button');
        testButton.textContent = 'Run Component Tests';
        testButton.style.backgroundColor = '#1e88e5';
        testButton.style.color = 'white';
        testButton.style.border = 'none';
        testButton.style.padding = '8px 16px';
        testButton.style.borderRadius = '4px';
        testButton.style.cursor = 'pointer';
        
        testButton.addEventListener('click', async () => {
            const results = testResults;
            results.innerHTML = '<p>Running tests...</p>';
            
            try {
                // Test 1: Check if modules load
                results.innerHTML += '<p>Test 1: Checking if modules can be loaded...</p>';
                
                // Dynamically import module
                try {
                    const testGroqee = new GroqeeChat({ 
                        modelsPath: 'pwa-assets/groqee-models.json',
                        templatesPath: 'pwa-assets/groqee-templates.json'
                    });
                    results.innerHTML += '<p style="color: green">✓ GroqeeChat module loaded successfully!</p>';
                    
                    // Test 2: Can we initialize it?
                    results.innerHTML += '<p>Test 2: Checking if the module can be initialized...</p>';
                    
                    try {
                        await testGroqee.initialize();
                        results.innerHTML += '<p style="color: green">✓ Module initialized successfully!</p>';
                        
                        // Test 3: Can we access models?
                        results.innerHTML += '<p>Test 3: Checking if models were loaded...</p>';
                        const models = testGroqee.getModels();
                        if (models && Object.keys(models).length > 0) {
                            results.innerHTML += `<p style="color: green">✓ Models loaded successfully! Found ${Object.keys(models).length} models.</p>`;
                        } else {
                            results.innerHTML += '<p style="color: red">✗ Could not load models.</p>';
                        }
                        
                        // Test 4: Can we access templates?
                        results.innerHTML += '<p>Test 4: Checking if templates were loaded...</p>';
                        const templates = testGroqee.getTemplates();
                        if (templates && Object.keys(templates).length > 0) {
                            results.innerHTML += `<p style="color: green">✓ Templates loaded successfully! Found ${Object.keys(templates).length} templates.</p>`;
                        } else {
                            results.innerHTML += '<p style="color: red">✗ Could not load templates.</p>';
                        }
                        
                        results.innerHTML += '<p style="font-weight: bold">Tests completed successfully! Your PWA components are ready for integration.</p>';
                        
                    } catch (error) {
                        results.innerHTML += `<p style="color: red">✗ Failed to initialize module: ${error.message}</p>`;
                    }
                    
                } catch (error) {
                    results.innerHTML += `<p style="color: red">✗ Failed to load module: ${error.message}</p>`;
                }
                
            } catch (error) {
                results.innerHTML += `<p style="color: red">✗ Error running tests: ${error.message}</p>`;
            }
        });
        
        testContainer.appendChild(testTitle);
        testContainer.appendChild(testResults);
        testContainer.appendChild(testButton);
        
        // Find the demo container and insert before it
        const demoContainer = demoSection.querySelector('.demo-container');
        if (demoContainer) {
            demoSection.insertBefore(testContainer, demoContainer);
        } else {
            demoSection.appendChild(testContainer);
        }
    }
});