(function() {
    'use strict';

    class MasonryGridWidget {
        constructor() {
            // Find the target container
            this.container = document.getElementById('masonry-grid-widget');
            if (!this.container) {
                console.error('Masonry grid target element not found. Please include <div id="masonry-grid-widget"></div> in your HTML.');
                return;
            }

            this.gridData = [];
            this.isAdminMode = false;
            this.activeTab = 0;
            this.hasUnsavedChanges = false;
            this.originalData = null;
            this.sectionId = null;
            this.lastClickTime = 0; // For debouncing rapid clicks
            this.assetLibraryToken = null; // Bearer token for browsing asset library
            this.assetAuthToken = null; // Bearer token for video/asset playback
            this.currentMediaAssets = []; // Store current media assets for selection
            this.tempRowImages = {}; // Temporary storage for images during layout changes

            // Layout options
            this.layoutOptions = [
                { id: '100', name: '100%', items: 1 },
                { id: '50-50', name: '50% / 50%', items: 2 },
                { id: '50p-50l', name: 'Portrait + Landscape', items: 2 },
                { id: '25s-75l', name: 'Stack + Landscape', items: 3 },
                { id: '67l-33l', name: '2/3 + 1/3', items: 2 },
                { id: '33l-67l', name: '1/3 + 2/3', items: 2 },
                { id: '67-left', name: '2/3 Left Aligned', items: 2 },
                { id: '67-right', name: '2/3 Right Aligned', items: 2 },
                { id: '33-33-33', name: '33% / 33% / 33%', items: 3 },
                { id: '50-25-25', name: '50% / 25% / 25%', items: 3 },
                { id: '25-25-50', name: '25% / 25% / 50%', items: 3 },
                { id: '25-50-25', name: '25% / 50% / 25%', items: 3 },
                { id: '25-25-25-25', name: '25% / 25% / 25% / 25%', items: 4 },
                // Advanced Layout Options
                { id: '70-15-15', name: 'Hero + Grid', items: 3 },
                { id: '60-20-20', name: 'Asymmetric Emphasis', items: 3 },
                { id: 'irregular-6', name: 'Pinterest Style (5)', items: 5 },
                { id: 'two-row-6', name: 'Two Row Grid (6)', items: 6 }
            ];

            // Initialize the widget
            this.init();
        }

        async init() {
            console.log('🎯 Initializing Masonry Grid Widget...');
            
            // Detect section ID for data storage
            this.detectSectionId();
            
            // Create the initial HTML structure
            this.createHTMLStructure();
            
            // Create and inject admin controls as first child of html tag
            this.createAdminControls();
            
            // Now initialize all element references
            this.initializeElements();
            
            // Add event listeners
            this.attachEventListeners();
            
            // Check admin status and show button if admin
            this.checkAdminStatus();

            // Load widget data
            await this.loadWidgetData();
        }

        createAdminControls() {
            // Find the html element
            const htmlElement = document.documentElement;
            if (!htmlElement) {
                console.warn('No html element found, admin controls will not be injected');
                return;
            }

            // Create admin controls element
            const adminControlsElement = document.createElement('div');
            adminControlsElement.id = 'masonry-admin-controls';
            adminControlsElement.className = 'admin-controls';
            adminControlsElement.style.display = 'none'; // Hide by default to prevent unstyled flashes
            adminControlsElement.innerHTML = `
                <div class="admin-panel">
                    <div class="admin-header">
                        <h2 class="admin-title">Edit Gallery</h2>
                        <div>
                            <button id="masonry-admin-close-btn" class="admin-close-btn">✕</button>
                        </div>
                    </div>
                    <div class="admin-body">
                        <div class="admin-tabs" id="masonry-admin-tabs"></div>
                        <div class="admin-form" id="masonry-admin-form"></div>
                    </div>
                    <div class="admin-footer">
                        <div id="masonry-admin-status" class="admin-status" style="display: none;"></div>
                        <div class="admin-actions">
                            <button id="masonry-admin-discard-btn" class="btn btn-secondary" style="display: none;">Discard Changes</button>
                            <button id="masonry-admin-save-btn" class="btn btn-primary" style="display: none;">Save Changes</button>
                        </div>
                    </div>
                </div>
            `;

            // Insert as first child of html element
            htmlElement.insertBefore(adminControlsElement, htmlElement.firstChild);
        }

        detectSectionId() {
            console.log('🔍 Starting section ID detection...');
            console.log('📍 Container element:', this.container);
            
            // Find the closest parent section element
            let parentSection = this.container.closest('section[data-section-id]');
            
            // If no section with data-section-id, look for any section and use its position
            if (!parentSection) {
                parentSection = this.container.closest('section');
                if (parentSection) {
                    // Generate a section ID based on position
                    const sections = document.querySelectorAll('section');
                    const sectionIndex = Array.from(sections).indexOf(parentSection);
                    this.sectionId = `section-${sectionIndex}`;
                    console.log('📍 Generated section ID from position:', this.sectionId);
                } else {
                    // Fallback: use a default ID
                    this.sectionId = 'default-masonry-grid';
                    console.log('⚠️ No parent section found, using default ID:', this.sectionId);
                }
            } else {
                this.sectionId = parentSection.getAttribute('data-section-id');
                console.log('✅ Found section ID:', this.sectionId);
            }
        }

        async checkAdminStatus() {
            try {
                // Check if user is authenticated as admin
                const isAdmin = await this.isUserAdmin();
                if (isAdmin) {
                    this.adminToggleBtn.classList.remove('hidden');
                }
            } catch (error) {
                // Admin check failed silently
                console.log('Admin status check failed');
            }
        }

        async handleAdminToggle() {
            // Debounce rapid clicks (ignore clicks within 500ms of each other)
            const currentTime = Date.now();
            if (currentTime - this.lastClickTime < 500) {
                console.log('🚫 Ignoring rapid click to prevent accidental admin mode trigger');
                return;
            }
            this.lastClickTime = currentTime;
            
            // Check admin status only when button is clicked
            const isAdmin = await this.isUserAdmin();
            if (isAdmin) {
                this.toggleAdminMode();
            } else {
                alert("Admin access required. Please log in as an administrator.");
                this.adminToggleBtn.classList.add('hidden');
            }
        }

        createHTMLStructure() {
            this.container.innerHTML = `
                <!-- Admin toggle button (shown only to admins) -->
                <button id="masonry-admin-toggle-btn" class="admin-toggle-btn hidden">Edit Gallery</button>
                
                <div class="masonry-grid" id="masonry-grid"></div>
            `;
        }

        initializeElements() {
            // Grid elements
            this.masonryGrid = document.getElementById('masonry-grid');
            
            // Admin elements
            this.adminToggleBtn = document.getElementById('masonry-admin-toggle-btn');
            this.adminControls = document.getElementById('masonry-admin-controls');
            this.adminTabs = document.getElementById('masonry-admin-tabs');
            this.adminForm = document.getElementById('masonry-admin-form');
            this.adminSaveBtn = document.getElementById('masonry-admin-save-btn');
            this.adminCloseBtn = document.getElementById('masonry-admin-close-btn');
            this.adminDiscardBtn = document.getElementById('masonry-admin-discard-btn');
            this.adminStatus = document.getElementById('masonry-admin-status');
            this.adminFooter = this.adminControls.querySelector('.admin-footer');
        }

        attachEventListeners() {
            // 🚫 NUCLEAR CLICK BLOCKING APPROACH 🚫 (from successful reference implementation)
            // AGGRESSIVE approach: Block click events entirely and use mousedown for our controls
            console.log('🛡️ Setting up AGGRESSIVE click blocking with mousedown fallback...');
            
            // NUCLEAR OPTION: Block ALL click and dblclick events on admin area AND grid
            document.addEventListener('click', (event) => {
                const target = event.target;
                
                // If it's anywhere in our admin controls OR grid during admin mode, block the click entirely
                if ((target && target.closest('.admin-panel')) || 
                    (this.isAdminMode && target && target.closest('.masonry-grid-container'))) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return false;
                }
            }, true); // Use capture phase
            
            // Block double-clicks everywhere in admin AND grid during admin mode
            document.addEventListener('dblclick', (event) => {
                const target = event.target;
                
                if ((target && target.closest('.admin-panel')) || 
                    (this.isAdminMode && target && target.closest('.masonry-grid-container'))) {
                    console.log('🛡️ BLOCKING dblclick event in admin/grid area:', target);
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return false;
                }
            }, true); // Use capture phase
            
            // Block other pointer events that could trigger edit mode
            const blockEvents = ['mouseup', 'pointerup', 'touchend'];
            blockEvents.forEach(eventType => {
                document.addEventListener(eventType, (event) => {
                    const target = event.target;
                    if ((target && target.closest('.admin-panel')) || 
                        (this.isAdminMode && target && target.closest('.masonry-grid-container'))) {
                        console.log(`🛡️ BLOCKING ${eventType} event in admin/grid area:`, target);
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        return false;
                    }
                }, true);
            });

            // MOUSEDOWN REPLACEMENT SYSTEM - All functionality through mousedown
            this.adminToggleBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleAdminToggle();
            });
            
            this.adminSaveBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveConfiguration();
            });
            
            this.adminCloseBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleAdminClose();
            });
            
            this.adminDiscardBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.discardChanges();
                this.toggleAdminMode();
            });

            // EVENT DELEGATION for dynamic buttons - ALL through mousedown
            document.addEventListener('mousedown', (e) => {
                // Handle all dynamic buttons created in admin interface
                const target = e.target;
                
                // Full-width toggle switch
                if (target.closest('.toggle-switch')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const toggle = target.closest('.toggle-switch');
                    const rowIndex = parseInt(toggle.getAttribute('data-row-index'));
                    const isCurrentlyActive = toggle.classList.contains('active');
                    
                    if (this.gridData[rowIndex]) {
                        // Toggle the state
                        const newFullWidthState = !isCurrentlyActive;
                        this.gridData[rowIndex].fullWidth = newFullWidthState;
                        
                        // Update the UI
                        if (newFullWidthState) {
                            toggle.classList.add('active');
                        } else {
                            toggle.classList.remove('active');
                        }
                        
                        this.renderGrid();
                        this.markAsChanged();
                    }
                    return false;
                }
                
                // Layout dropdown toggle
                if (target.closest('.current-layout-display')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const rowIndex = target.closest('.visual-layout-selector').dataset.rowIndex;
                    if (rowIndex !== undefined) {
                        this.toggleLayoutDropdown(parseInt(rowIndex));
                    }
                    return false;
                }
                
                // Layout option selection
                if (target.closest('.layout-option-dropdown')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const option = target.closest('.layout-option-dropdown');
                    const layoutId = option.getAttribute('data-layout');
                    const rowIndex = option.closest('.visual-layout-selector').dataset.rowIndex;
                    if (layoutId && rowIndex !== undefined) {
                        this.selectLayoutFromDropdown(layoutId, parseInt(rowIndex));
                    }
                    return false;
                }
                
                // Area menu button (single icon that opens context menu)
                if (target.closest('.area-menu-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const btn = target.closest('.area-menu-btn');
                    const rowIndex = btn.getAttribute('data-row');
                    const itemIndex = btn.getAttribute('data-item');
                    if (rowIndex !== null && itemIndex !== null) {
                        this.toggleAreaContextMenu(parseInt(rowIndex), parseInt(itemIndex), e);
                    }
                    return false;
                }
                
                // Context menu item handlers (library, upload, remove)
                if (target.closest('.area-menu-item')) {
                    const menuItem = target.closest('.area-menu-item');
                    
                    // Handle library selection
                    if (menuItem.classList.contains('area-btn-library')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        const rowIndex = menuItem.getAttribute('data-row');
                        const itemIndex = menuItem.getAttribute('data-item');
                        if (rowIndex !== null && itemIndex !== null) {
                            this.closeAllAreaContextMenus();
                            this.selectFromLibrary(parseInt(rowIndex), parseInt(itemIndex));
                        }
                        return false;
                    }
                    
                    // Handle file upload
                    if (menuItem.classList.contains('area-btn-upload')) {
                        console.log('🖼️ Context menu upload button mousedown detected for element:', target);
                        
                        // DON'T prevent default on mousedown - let it be "trusted"
                        // Only stop propagation to prevent bubbling
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        const rowIndex = menuItem.getAttribute('data-row');
                        const itemIndex = menuItem.getAttribute('data-item');
                        if (rowIndex !== null && itemIndex !== null) {
                            console.log('🖼️ Starting immediate file picker for position:', rowIndex, itemIndex);
                            this.closeAllAreaContextMenus();
                            this.uploadNewImage(parseInt(rowIndex), parseInt(itemIndex));
                        }
                        return false;
                    }
                    
                    // Handle remove media
                    if (menuItem.classList.contains('area-btn-remove')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        const rowIndex = menuItem.getAttribute('data-row');
                        const itemIndex = menuItem.getAttribute('data-item');
                        if (rowIndex !== null && itemIndex !== null) {
                            this.closeAllAreaContextMenus();
                            this.removeImage(parseInt(rowIndex), parseInt(itemIndex));
                        }
                        return false;
                    }
                }
                
                // Legacy area buttons (keep for backwards compatibility but these shouldn't be used anymore)
                if (target.closest('.area-btn-library')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.area-btn-library');
                    const rowIndex = btn.getAttribute('data-row');
                    const itemIndex = btn.getAttribute('data-item');
                    if (rowIndex !== null && itemIndex !== null) {
                        this.selectFromLibrary(parseInt(rowIndex), parseInt(itemIndex));
                    }
                    return false;
                }
                
                if (target.closest('.area-btn-upload')) {
                    console.log('🖼️ Upload button mousedown detected for element:', target);
                    
                    // DON'T prevent default on mousedown - let it be "trusted"
                    // Only stop propagation to prevent bubbling
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    const btn = target.closest('.area-btn-upload');
                    const rowIndex = btn.getAttribute('data-row');
                    const itemIndex = btn.getAttribute('data-item');
                    if (rowIndex !== null && itemIndex !== null) {
                        console.log('🖼️ Starting immediate file picker for position:', rowIndex, itemIndex);
                        this.uploadNewImage(parseInt(rowIndex), parseInt(itemIndex));
                    }
                    return false;
                }
                
                if (target.closest('.area-btn-remove')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.area-btn-remove');
                    const rowIndex = btn.getAttribute('data-row');
                    const itemIndex = btn.getAttribute('data-item');
                    if (rowIndex !== null && itemIndex !== null) {
                        this.removeImage(parseInt(rowIndex), parseInt(itemIndex));
                    }
                    return false;
                }
                
                // Row options button
                if (target.closest('.row-options-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.row-options-btn');
                    const rowIndex = btn.getAttribute('data-row-index');
                    if (rowIndex !== null) {
                        this.showRowOptionsMenu(e, parseInt(rowIndex));
                    }
                    return false;
                }

                // Reorder toggle button
                if (target.closest('.reorder-toggle-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleReorderMode();
                    return false;
                }

                // Row move buttons
                if (target.closest('.row-move-btn')) {
                    console.log('🎯 Move button nuclear click handler triggered');
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.row-move-btn');
                    const rowIndex = btn.getAttribute('data-row-index');
                    const direction = btn.getAttribute('data-direction');
                    console.log('🎯 Move button data:', { rowIndex, direction });
                    if (rowIndex !== null && direction) {
                        if (direction === 'up') {
                            console.log('🎯 Moving row up:', rowIndex);
                            this.moveRowUp(parseInt(rowIndex));
                        } else if (direction === 'down') {
                            console.log('🎯 Moving row down:', rowIndex);
                            this.moveRowDown(parseInt(rowIndex));
                        }
                    }
                    return false;
                }

                // Row options menu items
                if (target.closest('.menu-option-draft')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.menu-option-draft');
                    const rowIndex = btn.getAttribute('data-row-index');
                    if (rowIndex !== null) {
                        this.toggleRowDraft(parseInt(rowIndex));
                    }
                    return false;
                }

                if (target.closest('.menu-option-duplicate')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.menu-option-duplicate');
                    const rowIndex = btn.getAttribute('data-row-index');
                    if (rowIndex !== null) {
                        this.duplicateRow(parseInt(rowIndex));
                    }
                    return false;
                }

                if (target.closest('.menu-option-delete')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.menu-option-delete');
                    const rowIndex = btn.getAttribute('data-row-index');
                    if (rowIndex !== null) {
                        this.deleteRow(parseInt(rowIndex));
                    }
                    return false;
                }

                // Delete row button
                if (target.closest('.btn-danger') && target.textContent.includes('Delete')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.btn-danger');
                    const rowIndex = btn.getAttribute('data-row-index');
                    if (rowIndex !== null) {
                        this.removeRow(parseInt(rowIndex));
                    }
                    return false;
                }
                
                // Tab buttons
                if (target.closest('.tab-button')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = target.closest('.tab-button');
                    const tabIndex = btn.getAttribute('data-tab-index');
                    if (tabIndex !== null) {
                        this.switchTab(parseInt(tabIndex));
                    }
                    return false;
                }
                
                // Layout option buttons (add row)
                if (target.closest('.layout-option')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const option = target.closest('.layout-option');
                    const layoutId = option.getAttribute('data-layout');
                    if (layoutId) {
                        this.addRowWithLayout(layoutId);
                    }
                    return false;
                }
                
                // Asset grid items
                if (target.closest('.asset-grid-item')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const item = target.closest('.asset-grid-item');
                    const assetIndex = item.getAttribute('data-asset-index');
                    const rowIndex = item.getAttribute('data-row-index');
                    const itemIndex = item.getAttribute('data-item-index');
                    
                    if (assetIndex !== null && rowIndex !== null && itemIndex !== null) {
                        // Get the asset data from filtered assets (if available) or stored media assets
                        const assetsToUse = this.filteredAssets || this.currentMediaAssets;
                        const asset = assetsToUse[parseInt(assetIndex)];
                        if (asset) {
                            this.selectAsset(asset, parseInt(rowIndex), parseInt(itemIndex));
                        }
                    }
                    return false;
                }
                

                
                // Modal close buttons
                if (target.closest('.asset-modal-close') || (target.closest('.btn-primary') && target.textContent === 'OK')) {
                    e.preventDefault();
                    e.stopPropagation();
                    target.closest('.asset-modal-overlay')?.remove();
                    return false;
                }
            });
            
            // Block subsequent click events AFTER mousedown for upload buttons
            const uploadBlockEvents = ['click', 'mouseup', 'pointerup', 'touchend'];
            
            uploadBlockEvents.forEach(eventType => {
                document.addEventListener(eventType, (event) => {
                    const target = event.target;
                    if (target && (target.closest('.area-btn-upload') || target.closest('.area-menu-item.area-btn-upload'))) {
                        console.log(`🛡️ Blocking ${eventType} event on upload button`);
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        return false;
                    }
                }, true);
            });

            // Close dropdowns and context menus when clicking outside (keep this as click for outside detection)
            document.addEventListener('click', (e) => {
                // Close layout dropdowns
                if (!e.target.closest('.visual-layout-selector')) {
                    document.querySelectorAll('.layout-dropdown').forEach(dd => {
                        dd.classList.remove('open');
                        const arrow = dd.closest('.visual-layout-selector').querySelector('.dropdown-arrow');
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    });
                }
                
                // Close area context menus
                if (!e.target.closest('.area-overlay')) {
                    this.closeAllAreaContextMenus();
                }
            });
            
            // Height selector change event (using change event for select elements)
            document.addEventListener('change', (e) => {
                if (e.target.closest('.height-selector')) {
                    const select = e.target.closest('.height-selector');
                    const rowIndex = parseInt(select.getAttribute('data-row-index'));
                    const newHeight = select.value;
                    
                    if (this.gridData[rowIndex]) {
                        this.gridData[rowIndex].height = newHeight;
                        this.renderGrid();
                        this.markAsChanged();
                    }
                }
            });
        }

        async isUserAdmin() {
            try {
                // Try to access admin API endpoint to check if user is authenticated
                const response = await fetch('/api/config/GetInjectionSettings', {
                    method: 'GET',
                    credentials: 'include'
                });

                return response.ok;
            } catch (error) {
                return false;
            }
        }

        toggleAdminMode() {
            this.isAdminMode = !this.isAdminMode;

            if (this.isAdminMode) {
                // Create backdrop if it doesn't exist
                if (!this.adminBackdrop) {
                    this.adminBackdrop = document.createElement('div');
                    this.adminBackdrop.className = 'admin-drawer-backdrop';
                    this.adminBackdrop.addEventListener('click', () => {
                        this.handleBackdropClick();
                    });
                    document.body.appendChild(this.adminBackdrop);
                }
                
                this.adminControls.style.display = 'block'; // Override the default display: none
                
                // Small delay to ensure display change takes effect before adding show class
                setTimeout(() => {
                    this.adminControls.classList.add('show');
                    this.adminBackdrop.classList.add('show');
                }, 10);
                
                this.adminToggleBtn.style.display = 'none'; // Hide the button when drawer is open
                document.body.classList.add('admin-drawer-open');
                
                // Debug logging for scroll issues
                console.log('🔍 Admin drawer opened - debugging scroll setup:');
                console.log('📱 Body classes:', document.body.className);
                console.log('📏 Body style overflow:', window.getComputedStyle(document.body).overflow);
                console.log('📐 Body style position:', window.getComputedStyle(document.body).position);
                
                // Check admin columns after a delay to ensure they're rendered
                setTimeout(() => {
                    const leftColumn = document.querySelector('.admin-left-column');
                    const rightColumn = document.querySelector('.admin-right-column');
                    
                    if (leftColumn) {
                        console.log('📋 Left column found');
                        console.log('📋 Left column overflow-y:', window.getComputedStyle(leftColumn).overflowY);
                        console.log('📋 Left column height:', window.getComputedStyle(leftColumn).height);
                        console.log('📋 Left column scroll height:', leftColumn.scrollHeight);
                        console.log('📋 Left column client height:', leftColumn.clientHeight);
                    } else {
                        console.log('❌ Left column not found');
                    }
                    
                    if (rightColumn) {
                        console.log('📊 Right column found');
                        console.log('📊 Right column overflow-y:', window.getComputedStyle(rightColumn).overflowY);
                        console.log('📊 Right column height:', window.getComputedStyle(rightColumn).height);
                        console.log('📊 Right column scroll height:', rightColumn.scrollHeight);
                        console.log('📊 Right column client height:', rightColumn.clientHeight);
                    } else {
                        console.log('❌ Right column not found');
                    }
                }, 100);
                
                // Store original data for change detection
                this.originalData = JSON.parse(JSON.stringify(this.gridData));
                this.hasUnsavedChanges = false;
                
                // Reset accordion states to ensure clean slate when opening drawer
                this.resetAllAccordionStates();
                
                this.renderAdminForm();
            } else {
                // Reset reorder mode when closing drawer
                this.resetReorderMode();
                
                this.adminControls.classList.remove('show');
                if (this.adminBackdrop) {
                    this.adminBackdrop.classList.remove('show');
                }
                
                // Wait for animation to complete before hiding
                setTimeout(() => {
                    this.adminControls.style.display = 'none'; // Hide with inline style
                }, 400); // Match the CSS transition duration
                
                this.adminToggleBtn.style.display = 'block'; // Show the button when drawer is closed
                this.adminToggleBtn.textContent = 'Edit Gallery';
                this.hideAdminFooter();
                document.body.classList.remove('admin-drawer-open');
                this.hasUnsavedChanges = false;
            }
        }

        resetAllAccordionStates() {
            // Reset any existing accordion states to ensure clean slate
            const accordions = document.querySelectorAll('.accordion-item');
            accordions.forEach(accordion => {
                const content = accordion.querySelector('.accordion-content');
                const arrow = accordion.querySelector('.accordion-arrow');
                
                // Remove expanded state
                accordion.classList.remove('expanded');
                
                // Reset content display
                if (content) {
                    content.classList.remove('active');
                    content.style.display = 'none';
                }
                
                // Reset arrow rotation
                if (arrow) {
                    arrow.style.transform = 'rotate(0deg)';
                }
            });
        }

        saveAccordionStates() {
            const accordions = document.querySelectorAll('.accordion-item');
            const states = [];
            
            accordions.forEach((accordion, index) => {
                const isExpanded = accordion.classList.contains('expanded');
                states.push({ index, isExpanded });
            });
            
            return states;
        }
        
        restoreAccordionStates(states) {
            if (!states || states.length === 0) return;
            
            const accordions = document.querySelectorAll('.accordion-item');
            
            states.forEach(state => {
                if (accordions[state.index] && state.isExpanded) {
                    const accordion = accordions[state.index];
                    const content = accordion.querySelector('.accordion-content');
                    const arrow = accordion.querySelector('.accordion-arrow');
                    
                    accordion.classList.add('expanded');
                    if (content) {
                        content.style.display = 'block';
                        content.classList.add('active');
                    }
                    if (arrow) arrow.style.transform = 'rotate(180deg)'; // Fixed: was 90deg
                }
            });
        }

        saveDetailedAccordionStates() {
            const accordions = document.querySelectorAll('.accordion-item');
            const states = [];
            
            accordions.forEach((accordion) => {
                const rowIndex = accordion.getAttribute('data-row-index');
                const isExpanded = accordion.classList.contains('expanded');
                states.push({ rowIndex: parseInt(rowIndex), isExpanded });
            });
            
            return states;
        }
        
        restoreDetailedAccordionStates(states) {
            if (!states || states.length === 0) return;
            
            states.forEach(state => {
                const accordion = document.querySelector(`[data-row-index="${state.rowIndex}"]`);
                if (accordion) {
                    const content = accordion.querySelector('.accordion-content');
                    
                    if (state.isExpanded) {
                        // Restore expanded state using CSS classes
                        accordion.classList.add('expanded');
                        if (content) {
                            content.classList.add('active');
                        }
                    } else {
                        // Ensure collapsed state using CSS classes
                        accordion.classList.remove('expanded');
                        if (content) {
                            content.classList.remove('active');
                        }
                    }
                }
            });
        }

        showTabPanel(panelIndex) {
            // Hide all panels
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // Show selected panel
            const targetPanel = document.querySelector(`[data-panel-index="${panelIndex}"]`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        }

        createGridRowsPanel() {
            // Create main container with two columns
            const mainContainer = document.createElement('div');
            mainContainer.className = 'admin-main-container';

            // Left column (2/3) - Existing rows
            const leftColumn = document.createElement('div');
            leftColumn.className = 'admin-left-column';
            
            // Create header container with title and toggle button
            const leftHeaderContainer = document.createElement('div');
            leftHeaderContainer.className = 'column-header-container';
            
            const leftHeader = document.createElement('h3');
            leftHeader.textContent = 'Current Rows';
            leftHeader.className = 'column-header';
            
            const reorderToggleBtn = document.createElement('button');
            reorderToggleBtn.className = 'reorder-toggle-btn';
            reorderToggleBtn.textContent = 'Change Order';
            reorderToggleBtn.title = 'Toggle row reordering mode';
            reorderToggleBtn.setAttribute('data-reorder-active', 'false');
            
            leftHeaderContainer.appendChild(leftHeader);
            leftHeaderContainer.appendChild(reorderToggleBtn);
            leftColumn.appendChild(leftHeaderContainer);

            const gridRowsContent = document.createElement('div');
            gridRowsContent.className = 'admin-panel-content';

            // Add existing rows
            if (this.gridData.length > 0) {
                this.gridData.forEach((row, index) => {
                    const accordionItem = this.createRowAccordion(row, index);
                    gridRowsContent.appendChild(accordionItem);
                });
            } else {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = '<p>No rows yet. Select a layout from the right panel to add your first row.</p>';
                gridRowsContent.appendChild(emptyState);
            }

            leftColumn.appendChild(gridRowsContent);

            // Right column (1/3) - Layout builder
            const rightColumn = document.createElement('div');
            rightColumn.className = 'admin-right-column';
            
            const rightHeader = document.createElement('h3');
            rightHeader.textContent = 'Add row';
            rightHeader.className = 'column-header';
            rightColumn.appendChild(rightHeader);

            const layoutBuilder = this.createLayoutBuilder();
            rightColumn.appendChild(layoutBuilder);

            // Add columns to main container
            mainContainer.appendChild(leftColumn);
            mainContainer.appendChild(rightColumn);

            return mainContainer;
        }

        createStylesPanel() {
            // Initialize default style settings if they don't exist
            if (!this.styleSettings) {
                this.styleSettings = {
                    rowGap: 50,
                    itemGap: 50,
                    mobileRowGap: 30,
                    mobileItemGap: 20,
                    borderRadius: 8,
                    shadow: 'none',
                    hoverEffect: 'scale',
                    cropImages: true
                };
            }

            // Ensure mobile gap settings exist (for backward compatibility)
            if (this.styleSettings.mobileRowGap === undefined) {
                this.styleSettings.mobileRowGap = 30;
            }
            if (this.styleSettings.mobileItemGap === undefined) {
                this.styleSettings.mobileItemGap = 20;
            }
            if (this.styleSettings.cropImages === undefined) {
                this.styleSettings.cropImages = true;
            }

            // Create main container with two columns like Grid Rows
            const mainContainer = document.createElement('div');
            mainContainer.className = 'admin-main-container';

            // Left column (full width) - Style Controls
            const leftColumn = document.createElement('div');
            leftColumn.className = 'admin-left-column';
            leftColumn.style.flex = '1'; // Take full width
            leftColumn.style.borderRight = 'none'; // Remove right border
            
            const leftHeader = document.createElement('h3');
            leftHeader.textContent = 'Style Settings';
            leftHeader.className = 'column-header';
            leftColumn.appendChild(leftHeader);

            const stylesContainer = document.createElement('div');
            stylesContainer.className = 'styles-panel-container';

            // Spacing Section
            const spacingSection = document.createElement('div');
            spacingSection.className = 'style-section';
            
            const spacingTitle = document.createElement('h3');
            spacingTitle.textContent = 'Spacing';
            spacingTitle.className = 'style-section-title';
            spacingSection.appendChild(spacingTitle);

            // Row Gap Control
            const rowGapControl = this.createRangeControl('Row Gap', 'rowGap', this.styleSettings.rowGap, 0, 100, 'px');
            spacingSection.appendChild(rowGapControl);

            // Item Gap Control
            const itemGapControl = this.createRangeControl('Item Gap', 'itemGap', this.styleSettings.itemGap, 0, 100, 'px');
            spacingSection.appendChild(itemGapControl);

            // Mobile Row Gap Control
            const mobileRowGapControl = this.createRangeControl('Mobile Row Gap', 'mobileRowGap', this.styleSettings.mobileRowGap || 30, 0, 100, 'px');
            spacingSection.appendChild(mobileRowGapControl);

            // Mobile Item Gap Control
            const mobileItemGapControl = this.createRangeControl('Mobile Item Gap', 'mobileItemGap', this.styleSettings.mobileItemGap || 20, 0, 100, 'px');
            spacingSection.appendChild(mobileItemGapControl);

            stylesContainer.appendChild(spacingSection);

            // Border Radius Section
            const borderSection = document.createElement('div');
            borderSection.className = 'style-section';
            
            const borderTitle = document.createElement('h3');
            borderTitle.textContent = 'Border Radius';
            borderTitle.className = 'style-section-title';
            borderSection.appendChild(borderTitle);

            const borderRadiusControl = this.createRangeControl('Corner Radius', 'borderRadius', this.styleSettings.borderRadius, 0, 50, 'px');
            borderSection.appendChild(borderRadiusControl);

            // Effects Section
            const effectsSection = document.createElement('div');
            effectsSection.className = 'style-section';
            
            const effectsTitle = document.createElement('h3');
            effectsTitle.textContent = 'Effects';
            effectsTitle.className = 'style-section-title';
            effectsSection.appendChild(effectsTitle);

            // Shadow Control
            const shadowControl = this.createSelectControl('Shadow', 'shadow', this.styleSettings.shadow, [
                { value: 'none', label: 'None' },
                { value: 'light', label: 'Light' },
                { value: 'medium', label: 'Medium' },
                { value: 'heavy', label: 'Heavy' }
            ]);
            effectsSection.appendChild(shadowControl);

            // Hover Effect Control
            const hoverControl = this.createSelectControl('Hover Effect', 'hoverEffect', this.styleSettings.hoverEffect, [
                { value: 'none', label: 'None' },
                { value: 'scale', label: 'Scale' },
                { value: 'lift', label: 'Lift' },
                { value: 'fade', label: 'Fade' }
            ]);
            effectsSection.appendChild(hoverControl);

            // Crop Images Control
            const cropControl = this.createSelectControl('Crop Images to Fit', 'cropImages', this.styleSettings.cropImages, [
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
            ]);
            effectsSection.appendChild(cropControl);

            stylesContainer.appendChild(spacingSection);
            stylesContainer.appendChild(borderSection);
            stylesContainer.appendChild(effectsSection);

            leftColumn.appendChild(stylesContainer);

            // Right column (1/3) - Style Preview (Hidden for now)
            const rightColumn = document.createElement('div');
            rightColumn.className = 'admin-right-column';
            rightColumn.style.display = 'none'; // Hide the right column
            
            const rightHeader = document.createElement('h3');
            rightHeader.textContent = 'Preview';
            rightHeader.className = 'column-header';
            rightColumn.appendChild(rightHeader);

            const stylePreview = this.createStylePreview();
            rightColumn.appendChild(stylePreview);

            // Add columns to main container
            mainContainer.appendChild(leftColumn);
            mainContainer.appendChild(rightColumn);

            return mainContainer;
        }

        createStylePreview() {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'style-preview-container';
            previewContainer.id = 'style-preview-container';

            // Create mini masonry grid preview
            const previewGrid = document.createElement('div');
            previewGrid.className = 'style-preview-grid';

            // Create two rows with different layouts to showcase spacing
            const row1 = document.createElement('div');
            row1.className = 'style-preview-row';
            
            const row2 = document.createElement('div');
            row2.className = 'style-preview-row';

            // First row - 2 items (50-50 layout)
            const item1 = this.createPreviewItem('#667eea', '1');
            const item2 = this.createPreviewItem('#f093fb', '2');
            row1.appendChild(item1);
            row1.appendChild(item2);

            // Second row - 3 items (33-33-33 layout)
            const item3 = this.createPreviewItem('#4facfe', '3');
            const item4 = this.createPreviewItem('#43e97b', '4');
            const item5 = this.createPreviewItem('#fa709a', '5');
            row2.appendChild(item3);
            row2.appendChild(item4);
            row2.appendChild(item5);

            previewGrid.appendChild(row1);
            previewGrid.appendChild(row2);
            previewContainer.appendChild(previewGrid);

            // Add instructions
            const instructions = document.createElement('div');
            instructions.className = 'preview-instructions';
            instructions.innerHTML = '<p><small>Live preview of your style settings. Hover over items to see effects!</small></p>';
            previewContainer.appendChild(instructions);

            // Apply initial styles
            this.updatePreviewStyles();

            return previewContainer;
        }

        createPreviewItem(backgroundColor, number) {
            const item = document.createElement('div');
            item.className = 'style-preview-item';
            
            const itemImage = document.createElement('div');
            itemImage.className = 'style-preview-item-image';
            itemImage.style.backgroundColor = backgroundColor;
            itemImage.style.width = '100%';
            itemImage.style.height = '100%';
            
            const label = document.createElement('span');
            label.className = 'preview-item-label';
            label.textContent = number;
            itemImage.appendChild(label);
            
            item.appendChild(itemImage);
            return item;
        }

        updatePreviewStyles() {
            const previewContainer = document.getElementById('style-preview-container');
            if (!previewContainer) return;

            // Apply dynamic styles to preview
            const previewStyle = document.createElement('style');
            previewStyle.id = 'style-preview-dynamic-styles';
            
            // Remove existing preview styles
            const existingPreviewStyle = document.getElementById('style-preview-dynamic-styles');
            if (existingPreviewStyle) {
                existingPreviewStyle.remove();
            }

            const css = `
                .style-preview-row {
                    margin-bottom: ${this.styleSettings.rowGap ?? 50}px !important;
                    gap: ${this.styleSettings.itemGap ?? 50}px !important;
                }
                
                .style-preview-item {
                    border-radius: ${this.styleSettings.borderRadius ?? 8}px !important;
                    overflow: hidden !important;
                    ${this.getPreviewShadowCSS()}
                }
                
                .style-preview-item-image {
                    border-radius: ${this.styleSettings.borderRadius ?? 8}px !important;
                    ${this.getImageFitCSS()}
                    ${this.getPreviewHoverEffectCSS()}
                }
            `;

            previewStyle.textContent = css;
            document.head.appendChild(previewStyle);
        }

        getPreviewShadowCSS() {
            const shadows = {
                none: '',
                light: 'box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
                medium: 'box-shadow: 0 4px 16px rgba(0,0,0,0.15);',
                heavy: 'box-shadow: 0 8px 32px rgba(0,0,0,0.25);'
            };
            return shadows[this.styleSettings.shadow] || '';
        }

        getPreviewHoverEffectCSS() {
            const effects = {
                none: '',
                scale: 'transition: transform 0.3s ease; } .style-preview-item:hover .style-preview-item-image { transform: scale(1.05);',
                lift: 'transition: transform 0.3s ease, box-shadow 0.3s ease; } .style-preview-item:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.15);',
                fade: 'transition: opacity 0.3s ease; } .style-preview-item:hover .style-preview-item-image { opacity: 0.8;'
            };
            return effects[this.styleSettings.hoverEffect] || '';
        }

        createRangeControl(label, property, value, min, max, unit) {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'style-control-group';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.className = 'style-control-label';

            const inputContainer = document.createElement('div');
            inputContainer.className = 'range-input-container';

            const rangeInput = document.createElement('input');
            rangeInput.type = 'range';
            rangeInput.min = min;
            rangeInput.max = max;
            rangeInput.value = value;
            rangeInput.className = 'style-range-input';

            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = `${value}${unit}`;
            valueDisplay.className = 'style-value-display';

            rangeInput.addEventListener('input', (e) => {
                const newValue = parseInt(e.target.value);
                valueDisplay.textContent = `${newValue}${unit}`;
                this.styleSettings[property] = newValue;
                this.updateStyles();
                this.updatePreviewStyles();
                this.markAsChanged();
            });

            // Add click handler protection
            rangeInput.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            rangeInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            inputContainer.appendChild(rangeInput);
            inputContainer.appendChild(valueDisplay);
            
            controlGroup.appendChild(labelEl);
            controlGroup.appendChild(inputContainer);

            return controlGroup;
        }

        createSelectControl(label, property, value, options) {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'style-control-group';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.className = 'style-control-label';

            const select = document.createElement('select');
            select.className = 'style-select-input';

            options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                optionEl.selected = option.value === value;
                select.appendChild(optionEl);
            });

            select.addEventListener('change', (e) => {
                // Convert string values back to appropriate types
                let newValue = e.target.value;
                if (newValue === 'true') newValue = true;
                if (newValue === 'false') newValue = false;
                
                this.styleSettings[property] = newValue;
                this.updateStyles();
                this.updatePreviewStyles();
                this.markAsChanged();
            });

            // Add click handler protection
            select.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            select.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            controlGroup.appendChild(labelEl);
            controlGroup.appendChild(select);

            return controlGroup;
        }

        createToggleControl(label, property, value) {
            const controlGroup = document.createElement('div');
            controlGroup.className = 'style-control-group';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.className = 'style-control-label';

            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'toggle-container';

            const toggle = document.createElement('div');
            toggle.className = `toggle-switch ${value ? 'active' : ''}`;
            toggle.innerHTML = `
                <div class="toggle-slider"></div>
                <span class="toggle-label">${value ? 'On' : 'Off'}</span>
            `;

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newValue = !this.styleSettings[property];
                this.styleSettings[property] = newValue;
                
                // Update toggle appearance
                toggle.classList.toggle('active', newValue);
                toggle.querySelector('.toggle-label').textContent = newValue ? 'On' : 'Off';
                
                this.updateStyles();
                this.updatePreviewStyles();
                this.markAsChanged();
            });

            toggleContainer.appendChild(toggle);
            controlGroup.appendChild(labelEl);
            controlGroup.appendChild(toggleContainer);

            return controlGroup;
        }

        updateStyles() {
            // Apply the styles using CSS custom properties
            const container = document.querySelector('.masonry-container');
            if (container) {
                container.style.setProperty('--item-gap', `${this.styleSettings.itemGap ?? 50}px`);
                container.style.setProperty('--row-gap', `${this.styleSettings.rowGap ?? 50}px`);
                container.style.setProperty('--mobile-item-gap', `${this.styleSettings.mobileItemGap ?? 20}px`);
                container.style.setProperty('--mobile-row-gap', `${this.styleSettings.mobileRowGap ?? 30}px`);
                container.style.setProperty('--border-radius', `${this.styleSettings.borderRadius ?? 8}px`);
                
                // Add crop class to container
                container.classList.remove('image-crop', 'no-crop');
                if (this.styleSettings.cropImages === false) {
                    container.classList.add('no-crop');
                } else {
                    container.classList.add('image-crop');
                }
            }
            
            // Apply additional styles that can't be handled with custom properties
            const style = document.createElement('style');
            style.id = 'masonry-dynamic-styles';
            
            // Remove existing dynamic styles
            const existingStyle = document.getElementById('masonry-dynamic-styles');
            if (existingStyle) {
                existingStyle.remove();
            }

            const css = `
                .masonry-item {
                    border-radius: var(--border-radius) !important;
                    overflow: hidden !important;
                    ${this.getShadowCSS()}
                }
                
                .masonry-item-image {
                    border-radius: var(--border-radius) !important;
                    ${this.getImageFitCSS()}
                    ${this.getHoverEffectCSS()}
                }
                
                /* Override border radius for full-width rows */
                .masonry-row.full-width .masonry-item,
                .masonry-row.full-width .masonry-item-image {
                    border-radius: 0 !important;
                }
            `;

            style.textContent = css;
            document.head.appendChild(style);
        }

        getShadowCSS() {
            const shadows = {
                none: '',
                light: 'box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
                medium: 'box-shadow: 0 4px 16px rgba(0,0,0,0.15);',
                heavy: 'box-shadow: 0 8px 32px rgba(0,0,0,0.25);'
            };
            return shadows[this.styleSettings.shadow] || '';
        }

        getHoverEffectCSS() {
            const effects = {
                none: '',
                scale: 'transition: transform 0.3s ease; } .masonry-item:hover .masonry-item-image { transform: scale(1.05);',
                lift: 'transition: transform 0.3s ease, box-shadow 0.3s ease; } .masonry-item:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.15);',
                fade: 'transition: opacity 0.3s ease; } .masonry-item:hover .masonry-item-image { opacity: 0.8;'
            };
            return effects[this.styleSettings.hoverEffect] || '';
        }

        getImageFitCSS() {
            // When cropImages is false, preserve aspect ratio
            if (this.styleSettings.cropImages === false) {
                return 'object-fit: contain !important;';
            }
            // Default behavior is to crop/cover
            return 'object-fit: cover !important;';
        }

        renderAdminForm() {
            // Save current accordion states before re-rendering
            const accordionStates = this.saveDetailedAccordionStates();
            
            // Create main tabs
            this.adminTabs.innerHTML = '';
            this.adminForm.innerHTML = '';

            const gridRowsTab = document.createElement('button');
            gridRowsTab.className = 'admin-tab active tab-button';
            gridRowsTab.textContent = 'Grid Rows';
            gridRowsTab.setAttribute('data-tab-index', '0');

            const stylesTab = document.createElement('button');
            stylesTab.className = 'admin-tab tab-button';
            stylesTab.textContent = 'Styles';
            stylesTab.setAttribute('data-tab-index', '1');

            this.adminTabs.appendChild(gridRowsTab);
            this.adminTabs.appendChild(stylesTab);

            // Add tab switching functionality using mousedown to bypass NUCLEAR click blocking
            [gridRowsTab, stylesTab].forEach(tab => {
                tab.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Remove active class from all tabs
                    this.adminTabs.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                    // Add active class to clicked tab
                    tab.classList.add('active');
                    
                    // Show corresponding panel
                    this.showTabPanel(parseInt(tab.getAttribute('data-tab-index')));
                });
            });

            // Create tab panels container
            const tabPanelsContainer = document.createElement('div');
            tabPanelsContainer.className = 'tab-panels-container';

            // Create Grid Rows panel (existing content)
            const gridRowsPanel = this.createGridRowsPanel();
            gridRowsPanel.className = 'tab-panel active';
            gridRowsPanel.setAttribute('data-panel-index', '0');

            // Create Styles panel
            const stylesPanel = this.createStylesPanel();
            stylesPanel.className = 'tab-panel';
            stylesPanel.setAttribute('data-panel-index', '1');

            tabPanelsContainer.appendChild(gridRowsPanel);
            tabPanelsContainer.appendChild(stylesPanel);

            this.adminForm.appendChild(tabPanelsContainer);
            
            // Restore accordion states after re-rendering
            setTimeout(() => this.restoreDetailedAccordionStates(accordionStates), 0);
            
            // Add scroll debugging after admin form is rendered
            setTimeout(() => {
                this.addScrollDebugging();
            }, 100);
        }

        createLayoutBuilder() {
            const layoutBuilder = document.createElement('div');
            layoutBuilder.className = 'layout-builder';

            // Define layout options with visual representations
            const layouts = [
                { id: '100', name: 'Single', preview: this.createLayoutPreview('100', 'builder') },
                { id: '50-50', name: 'Half & Half', preview: this.createLayoutPreview('50-50', 'builder') },
                { id: '50p-50l', name: 'Portrait + Landscape', preview: this.createLayoutPreview('50p-50l', 'builder') },
                { id: '25s-75l', name: 'Stack + Landscape', preview: this.createLayoutPreview('25s-75l', 'builder') },
                { id: '67l-33l', name: '2/3 + 1/3', preview: this.createLayoutPreview('67l-33l', 'builder') },
                { id: '33l-67l', name: '1/3 + 2/3', preview: this.createLayoutPreview('33l-67l', 'builder') },
                { id: '33-33-33', name: '3 Columns', preview: this.createLayoutPreview('33-33-33', 'builder') },
                { id: '25-25-25-25', name: '4 Columns', preview: this.createLayoutPreview('25-25-25-25', 'builder') },
                { id: '25-50-25', name: 'Side + Center + Side', preview: this.createLayoutPreview('25-50-25', 'builder') },
                { id: '50-25-25', name: 'Left + Stack', preview: this.createLayoutPreview('50-25-25', 'builder') },
                { id: '25-25-50', name: 'Right + Stack', preview: this.createLayoutPreview('25-25-50', 'builder') },
                // Advanced Layouts
                { id: '70-15-15', name: 'Hero + Grid', preview: this.createLayoutPreview('70-15-15', 'builder') },
                { id: '60-20-20', name: 'Asymmetric Emphasis', preview: this.createLayoutPreview('60-20-20', 'builder') },
                { id: 'irregular-6', name: 'Pinterest Style (5)', preview: this.createLayoutPreview('irregular-6', 'builder') },
                { id: 'two-row-6', name: 'Two Row Grid (6)', preview: this.createLayoutPreview('two-row-6', 'builder') }
            ];

            layouts.forEach(layout => {
                const layoutOption = document.createElement('div');
                layoutOption.className = 'layout-option';
                layoutOption.setAttribute('data-layout', layout.id);
                
                // Add layout-specific class to the preview for CSS targeting
                const layoutClass = layout.id.replace(/[^a-zA-Z0-9]/g, '-'); // Convert layout ID to CSS-safe class
                
                layoutOption.innerHTML = `
                    <div class="layout-option-preview layout-${layoutClass}">
                        <div class="layout-preview">${layout.preview}</div>
                    </div>
                    <div class="layout-option-name">${layout.name}</div>
                `;

                // Event handled by delegation
                layoutBuilder.appendChild(layoutOption);
            });

            return layoutBuilder;
        }

        addRowWithLayout(layoutId) {
            // Update layout options to include all layouts
            const layoutData = {
                '100': { items: 1 },
                '50-50': { items: 2 },
                '50p-50l': { items: 2 },
                '25s-75l': { items: 3 },
                '67l-33l': { items: 2 },
                '33l-67l': { items: 2 },
                '67-left': { items: 2 },
                '67-right': { items: 2 },
                '33-33-33': { items: 3 },
                '50-25-25': { items: 3 },
                '25-25-50': { items: 3 },
                '25-50-25': { items: 3 },
                '25-25-25-25': { items: 4 },
                // Advanced Layouts
                '70-15-15': { items: 3 },
                '40-30-30': { items: 3 },
                '60-20-20': { items: 3 },
                'irregular-6': { items: 5 },
                'two-row-6': { items: 6 }
            };

            const layout = layoutData[layoutId];
            if (!layout) return;

            const newRow = {
                layout: layoutId,
                items: [],
                fullWidth: false, // Add full width property
                height: 'medium' // Add height property with default value
            };

            // Create items for the new row
            for (let i = 0; i < layout.items; i++) {
                // For 67-left layout, make the second item (index 1) empty/transparent
                // For 67-right layout, make the first item (index 0) empty/transparent
                const isEmptySpace = (layoutId === '67-left' && i === 1) || (layoutId === '67-right' && i === 0);
                
                if (isEmptySpace) {
                    newRow.items.push({
                        type: 'empty',
                        content: ''
                    });
                } else {
                    newRow.items.push({
                        type: 'placeholder',
                        background: `hsl(${(i * 60 + Math.random() * 30)}, 70%, 60%)`,
                        content: `Item ${i + 1}`
                    });
                }
            }

            this.gridData.push(newRow);
            this.renderGrid();
            this.renderAdminForm();
            this.markAsChanged();
        }

        getLayoutName(layoutId) {
            const layoutNames = {
                '100': 'Single',
                '50-50': 'Half & Half',
                '50p-50l': 'Portrait + Landscape',
                '25s-75l': 'Stack + Landscape',
                '67l-33l': '2/3 + 1/3',
                '33l-67l': '1/3 + 2/3',
                '67-left': '2/3 Left Aligned',
                '67-right': '2/3 Right Aligned',
                '33-33-33': '3 Columns',
                '50-25-25': 'Left + Stack',
                '25-25-50': 'Right + Stack',
                '25-50-25': 'Side + Center + Side',
                '25-25-25-25': '4 Columns',
                // Advanced Layouts
                '70-15-15': 'Hero + Grid',
                '60-20-20': 'Asymmetric Emphasis',
                'irregular-6': 'Pinterest Style (5)',
                'two-row-6': 'Two Row Grid (6)'
            };
            
            return layoutNames[layoutId] || 'Unknown Layout';
        }

        createLayoutPreview(layoutId, context = 'default') {
            const itemClass = context === 'builder' ? 'layout-builder-item' : 'layout-preview-item';
            
            // Create different templates based on context to avoid inline style conflicts
            if (context === 'builder') {
                // Builder context - no inline heights, let CSS handle sizing
                const builderLayoutMap = {
                    '100': `<div class="${itemClass}" style="flex: 1;"></div>`,
                    '50-50': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '50p-50l': `<div class="${itemClass}" style="flex: 1; height: 40px;"></div><div class="${itemClass}" style="flex: 1; height: 25px;"></div>`,
                    '25s-75l': `<div class="preview-left-stack" style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div><div class="${itemClass}" style="flex: 3;"></div>`,
                    '67l-33l': `<div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '33l-67l': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 2;"></div>`,
                    '67-left': `<div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1; opacity: 0.3;"></div>`,
                    '67-right': `<div class="${itemClass}" style="flex: 1; opacity: 0.3;"></div><div class="${itemClass}" style="flex: 2;"></div>`,
                    '33-33-33': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '50-25-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="preview-right-stack" style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div>`,
                    '25-25-50': `<div class="preview-left-stack" style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '25-50-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '25-25-25-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    // Advanced Layouts - no inline heights for builder
                    '70-15-15': `<div class="${itemClass}" style="flex: 7;"></div><div class="preview-right-stack" style="flex: 3; display: flex; flex-direction: column; gap: 2px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div>`,
                    '60-20-20': `<div class="${itemClass}" style="flex: 3;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    'irregular-6': `<div class="preview-irregular" style="display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5px; flex: 1;"><div class="${itemClass}" style="grid-row: 1/3;"></div><div class="${itemClass}"></div><div class="${itemClass}"></div><div class="${itemClass}"></div><div class="${itemClass}"></div></div>`,
                    'two-row-6': `<div class="preview-two-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5px; flex: 1;"><div class="${itemClass}" style="grid-column: 1/3; grid-row: 1;"></div><div class="${itemClass}" style="grid-column: 3; grid-row: 1/3;"></div><div class="${itemClass}" style="grid-column: 4; grid-row: 1;"></div><div class="${itemClass}" style="grid-column: 1; grid-row: 2;"></div><div class="${itemClass}" style="grid-column: 2; grid-row: 2;"></div><div class="${itemClass}" style="grid-column: 4; grid-row: 2;"></div></div>`
                };
                return builderLayoutMap[layoutId] || builderLayoutMap['50-50'];
            } else {
                // Accordion context - keep inline heights for compact display
                const accordionLayoutMap = {
                    '100': `<div class="${itemClass}" style="flex: 1;"></div>`,
                    '50-50': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '50p-50l': `<div class="${itemClass}" style="flex: 1; height: 20px;"></div><div class="${itemClass}" style="flex: 1; height: 12px;"></div>`,
                    '25s-75l': `<div class="preview-left-stack" style="flex: 0 0 25%; display: flex; flex-direction: column; gap: 3px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '67l-33l': `<div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '33l-67l': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 2;"></div>`,
                    '67-left': `<div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1; opacity: 0.3;"></div>`,
                    '67-right': `<div class="${itemClass}" style="flex: 1; opacity: 0.3;"></div><div class="${itemClass}" style="flex: 2;"></div>`,
                    '33-33-33': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '50-25-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="preview-right-stack" style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div>`,
                    '25-25-50': `<div class="preview-left-stack" style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '25-50-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 2;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    '25-25-25-25': `<div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div><div class="${itemClass}" style="flex: 1;"></div>`,
                    // Advanced Layouts - keep inline heights for accordion
                    '70-15-15': `<div class="${itemClass}" style="flex: 7; height: 20px;"></div><div class="preview-right-stack" style="flex: 3; display: flex; flex-direction: column; gap: 2px;"><div class="${itemClass}" style="flex: 1; height: 14px;"></div><div class="${itemClass}" style="flex: 1; height: 14px;"></div></div>`,
                    '60-20-20': `<div class="${itemClass}" style="flex: 3; height: 20px;"></div><div class="${itemClass}" style="flex: 1; height: 20px;"></div><div class="${itemClass}" style="flex: 1; height: 20px;"></div>`,
                    'irregular-6': `<div class="preview-irregular" style="display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5px; flex: 1; height: 30px;"><div class="${itemClass}" style="grid-row: 1/3;"></div><div class="${itemClass}"></div><div class="${itemClass}"></div><div class="${itemClass}"></div><div class="${itemClass}"></div></div>`,
                    'two-row-6': `<div class="preview-two-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5px; flex: 1; height: 30px;"><div class="${itemClass}" style="grid-column: 1/3; grid-row: 1;"></div><div class="${itemClass}" style="grid-column: 3; grid-row: 1/3;"></div><div class="${itemClass}" style="grid-column: 4; grid-row: 1;"></div><div class="${itemClass}" style="grid-column: 1; grid-row: 2;"></div><div class="${itemClass}" style="grid-column: 2; grid-row: 2;"></div><div class="${itemClass}" style="grid-column: 4; grid-row: 2;"></div></div>`
                };
                return accordionLayoutMap[layoutId] || accordionLayoutMap['50-50'];
            }
        }

        createRowAccordion(row, index) {
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';
            if (row.isDraft) {
                accordionItem.classList.add('draft-row');
            }
            accordionItem.setAttribute('data-row-index', index);

            const header = document.createElement('div');
            header.className = 'accordion-header';
            const layoutPreview = this.createLayoutPreview(row.layout);
            const layoutName = this.getLayoutName(row.layout);
            header.innerHTML = `
                <div class="accordion-header-content">
                    <div class="layout-preview layout-${row.layout.replace(/[^a-zA-Z0-9]/g, '-')}">${layoutPreview}</div>
                    <span class="row-label">${layoutName}${row.isDraft ? ' (draft)' : ''}</span>
                </div>
                <div class="row-controls">
                    <div class="move-controls">
                        <button class="row-move-btn row-move-up" data-row-index="${index}" data-direction="up" title="Move row up" ${index === 0 ? 'disabled' : ''}>
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 11V1M5 1L1 5M5 1L9 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="row-move-btn row-move-down" data-row-index="${index}" data-direction="down" title="Move row down" ${index === this.gridData.length - 1 ? 'disabled' : ''}>
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(180)">
                                <path d="M5 11V1M5 1L1 5M5 1L9 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="accordion-controls">
                        <span class="accordion-arrow"></span>
                        <button class="row-options-btn" data-row-index="${index}" title="Row options"></button>
                    </div>
                </div>
            `;

            const content = document.createElement('div');
            content.className = 'accordion-content';

            const rowForm = this.createRowForm(row, index);
            content.appendChild(rowForm);

            // Attach accordion toggle handler only to the chevron
            const accordionArrow = header.querySelector('.accordion-arrow');
            if (accordionArrow) {
                accordionArrow.addEventListener('mousedown', (e) => {
                    console.log('🖱️ Accordion arrow clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    this.preventSquarespaceInterference(e);
                    this.toggleAccordion(accordionItem);
                });
            }

            // Add options menu functionality
            const optionsBtn = header.querySelector('.row-options-btn');
            optionsBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showRowOptionsMenu(e, index);
            });

            // Add row move functionality
            const moveUpBtn = header.querySelector('.row-move-up');
            const moveDownBtn = header.querySelector('.row-move-down');
            
            if (moveUpBtn) {
                moveUpBtn.addEventListener('mousedown', (e) => {
                    console.log('🎯 Move up button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    this.moveRowUp(index);
                });
            }
            
            if (moveDownBtn) {
                moveDownBtn.addEventListener('mousedown', (e) => {
                    console.log('🎯 Move down button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    this.moveRowDown(index);
                });
            }

            accordionItem.appendChild(header);
            accordionItem.appendChild(content);

            return accordionItem;
        }

        addItemDragListeners(layoutDisplay, rowIndex) {
            const layoutAreas = layoutDisplay.querySelectorAll('.layout-area');
            
            layoutAreas.forEach(area => {
                // Skip empty space items - they shouldn't be draggable
                const emptySpaceLabel = area.querySelector('.empty-space-label');
                if (emptySpaceLabel) {
                    area.setAttribute('draggable', 'false');
                    area.style.cursor = 'default';
                    return; // Skip adding drag listeners for empty spaces
                }
                
                // Store the specific row index for this area to prevent cross-contamination
                area.setAttribute('data-drag-row-index', rowIndex);
                
                area.addEventListener('dragstart', (e) => {
                    // Prevent accordion state issues during drag
                    e.stopPropagation();
                    
                    const itemIndex = parseInt(area.getAttribute('data-item-index'));
                    const dragRowIndex = parseInt(area.getAttribute('data-drag-row-index'));
                    e.dataTransfer.setData('application/x-item-drag', JSON.stringify({ 
                        rowIndex: dragRowIndex, 
                        itemIndex,
                        sourceLayoutDisplay: area.closest('.layout-display')
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    area.classList.add('dragging-item');
                });

                area.addEventListener('dragend', (e) => {
                    // Prevent accordion state issues during drag
                    e.stopPropagation();
                    
                    area.classList.remove('dragging-item');
                    // Only clear drag-over from areas in the same layout display
                    const sameLayoutAreas = area.closest('.layout-display').querySelectorAll('.layout-area');
                    sameLayoutAreas.forEach(a => a.classList.remove('drag-over-item'));
                });

                area.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                });

                area.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (e.target.closest('.layout-area') !== area) return;
                    area.classList.add('drag-over-item');
                });

                area.addEventListener('dragleave', (e) => {
                    if (!area.contains(e.relatedTarget)) {
                        area.classList.remove('drag-over-item');
                    }
                });

                area.addEventListener('drop', (e) => {
                    e.preventDefault();
                    
                    // Only handle item drag data, ignore row drag data
                    const itemDragData = e.dataTransfer.getData('application/x-item-drag');
                    if (itemDragData) {
                        const dragData = JSON.parse(itemDragData);
                        const targetItemIndex = parseInt(area.getAttribute('data-item-index'));
                        const targetRowIndex = parseInt(area.getAttribute('data-drag-row-index'));
                        
                        // Only allow drops within the same row
                        if (dragData.rowIndex === targetRowIndex && dragData.itemIndex !== targetItemIndex) {
                            this.reorderItems(targetRowIndex, dragData.itemIndex, targetItemIndex);
                        }
                    }
                    
                    area.classList.remove('drag-over-item');
                });
            });
        }

        reorderItems(rowIndex, fromIndex, toIndex) {
            if (fromIndex === toIndex) return;
            
            const row = this.gridData[rowIndex];
            if (!row || !row.items) return;
            
            // Ensure we have items array
            if (!Array.isArray(row.items)) {
                row.items = [];
            }
            
            // Prevent swapping with empty space items
            if (row.items[fromIndex]?.type === 'empty' || row.items[toIndex]?.type === 'empty') {
                console.log('❌ Cannot swap with empty space items');
                return;
            }
            
            // Save accordion states BEFORE any rendering
            const accordionStates = this.saveDetailedAccordionStates();
            
            // Store current scroll position
            const currentScrollTop = document.querySelector('.admin-panel-content')?.scrollTop || 0;
            
            // Swap the items instead of just moving
            const temp = row.items[fromIndex];
            row.items[fromIndex] = row.items[toIndex];
            row.items[toIndex] = temp;
            
            // Re-render the grid first
            this.renderGrid();
            
            // Re-render admin form to show the updated item positions
            this.renderAdminForm();
            
            // Restore accordion states and scroll position with proper timing
            setTimeout(() => {
                this.restoreDetailedAccordionStates(accordionStates);
                // Restore scroll position
                const adminContent = document.querySelector('.admin-panel-content');
                if (adminContent) {
                    adminContent.scrollTop = currentScrollTop;
                }
            }, 50); // Increase timeout to ensure DOM is fully rendered
            
            console.log(`✅ Swapped items in row ${rowIndex}: ${fromIndex} ↔ ${toIndex}`);
            this.markAsChanged();
        }

        createRowForm(row, rowIndex) {
            const form = document.createElement('div');
            form.className = 'row-form';

            // Create container for layout selector only
            const topControls = document.createElement('div');
            topControls.className = 'row-top-controls';
            topControls.style.display = 'flex';
            topControls.style.gap = '15px';
            topControls.style.alignItems = 'flex-end';
            topControls.style.marginBottom = '20px';

            // Visual Layout Selector (full width)
            const layoutGroup = document.createElement('div');
            layoutGroup.className = 'form-group';
            layoutGroup.style.flex = '1';
            layoutGroup.innerHTML = `
                <label class="form-label">Layout</label>
                <div class="visual-layout-selector" data-row-index="${rowIndex}">
                    <div class="current-layout-display">
                        <div class="layout-preview">${this.createLayoutPreview(row.layout)}</div>
                        <span class="layout-name">${this.getLayoutName(row.layout)}</span>
                        <span class="dropdown-arrow"></span>
                    </div>
                    <div class="layout-dropdown" id="layout-dropdown-${rowIndex}">
                        ${this.createLayoutDropdownOptions(row.layout, rowIndex)}
                    </div>
                </div>
            `;

            topControls.appendChild(layoutGroup);
            form.appendChild(topControls);

            // Visual Layout Areas
            const layoutDisplay = document.createElement('div');
            layoutDisplay.className = 'layout-display';
            layoutDisplay.innerHTML = this.createVisualLayoutAreas(row, rowIndex);

            // Add drag functionality to layout areas
            this.addItemDragListeners(layoutDisplay, rowIndex);

            form.appendChild(layoutDisplay);

            // Create bottom controls for width and height (50% each)
            const bottomControls = document.createElement('div');
            bottomControls.className = 'row-bottom-controls';
            bottomControls.style.display = 'flex';
            bottomControls.style.gap = '15px';
            bottomControls.style.alignItems = 'flex-end';
            bottomControls.style.marginTop = '20px';

            // Full-width toggle (50% width)
            const fullWidthGroup = document.createElement('div');
            fullWidthGroup.className = 'form-group';
            fullWidthGroup.style.flex = '1';
            fullWidthGroup.innerHTML = `
                <label class="form-label">Width</label>
                <div class="full-width-toggle-container">
                    <div class="toggle-switch ${row.fullWidth ? 'active' : ''}" data-row-index="${rowIndex}">
                        <div class="toggle-switch-slider"></div>
                        <span class="toggle-switch-label">Full Width</span>
                    </div>
                </div>
            `;

            // Height selector (50% width)
            const heightGroup = document.createElement('div');
            heightGroup.className = 'form-group';
            heightGroup.style.flex = '1';
            heightGroup.innerHTML = `
                <label class="form-label">Height</label>
                <select class="form-select height-selector" data-row-index="${rowIndex}">
                    <option value="small" ${(row.height || 'medium') === 'small' ? 'selected' : ''}>Small</option>
                    <option value="medium" ${(row.height || 'medium') === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="large" ${(row.height || 'medium') === 'large' ? 'selected' : ''}>Large</option>
                </select>
            `;

            bottomControls.appendChild(fullWidthGroup);
            bottomControls.appendChild(heightGroup);
            form.appendChild(bottomControls);

            return form;
        }

        createLayoutDropdownOptions(currentLayout, rowIndex) {
            const layouts = [
                { id: '100', name: 'Single' },
                { id: '50-50', name: 'Half & Half' },
                { id: '50p-50l', name: 'Portrait + Landscape' },
                { id: '25s-75l', name: 'Stack + Landscape' },
                { id: '67l-33l', name: '2/3 + 1/3' },
                { id: '33l-67l', name: '1/3 + 2/3' },
                { id: '67-left', name: '2/3 Left Aligned' },
                { id: '67-right', name: '2/3 Right Aligned' },
                { id: '33-33-33', name: '3 Columns' },
                { id: '25-25-25-25', name: '4 Columns' },
                { id: '25-50-25', name: 'Side + Center + Side' },
                { id: '50-25-25', name: 'Left + Stack' },
                { id: '25-25-50', name: 'Right + Stack' },
                // Advanced Layouts
                { id: '70-15-15', name: 'Hero + Grid' },
                { id: '60-20-20', name: 'Asymmetric Emphasis' },
                { id: 'irregular-6', name: 'Pinterest Style (5)' },
                { id: 'two-row-6', name: 'Two Row Grid (6)' }
            ];

            return layouts.map(layout => `
                <div class="layout-option-dropdown ${layout.id === currentLayout ? 'selected' : ''}" 
                     data-layout="${layout.id}">
                    <div class="layout-preview">${this.createLayoutPreview(layout.id)}</div>
                    <span class="layout-name">${layout.name}</span>
                </div>
            `).join('');
        }

        createLayoutAreaHTML(row, rowIndex, itemIndex, defaultContent = null) {
            const item = row.items[itemIndex] || { type: 'placeholder', content: defaultContent || `Item ${itemIndex + 1}` };
            return `
                <div class="layout-area" draggable="true" data-row-index="${rowIndex}" data-item-index="${itemIndex}">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="area-content">
                        ${this.getAreaContentDisplay(item)}
                    </div>
                    ${this.createAreaOverlay(rowIndex, itemIndex, item)}
                </div>
            `;
        }

        createVisualLayoutAreas(row, rowIndex) {
            const layoutData = {
                '100': { items: 1 },
                '50-50': { items: 2 },
                '50p-50l': { items: 2 },
                '25s-75l': { items: 3 },
                '67l-33l': { items: 2 },
                '33l-67l': { items: 2 },
                '67-left': { items: 2 },
                '67-right': { items: 2 },
                '33-33-33': { items: 3 },
                '50-25-25': { items: 3 },
                '25-25-50': { items: 3 },
                '25-50-25': { items: 3 },
                '25-25-25-25': { items: 4 },
                // Advanced Layouts
                '70-15-15': { items: 3 },
                '40-30-30': { items: 3 },
                '60-20-20': { items: 3 },
                'irregular-6': { items: 5 },
                'two-row-6': { items: 6 }
            };
            
            const layout = layoutData[row.layout];
            if (!layout) return '';

            let areasHTML = '<div class="visual-layout-areas layout-' + row.layout + '">';
            
            if (row.layout === '50-25-25') {
                // Special handling for Left + Stack layout
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 0, 'Item 1');
                
                // Right stack container
                areasHTML += '<div class="admin-right-stack">';
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 1, 'Item 2');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 2, 'Item 3');
                areasHTML += '</div>'; // Close admin-right-stack
            } else if (row.layout === '25-25-50') {
                // Special handling for Right + Stack layout
                // Left stack container
                areasHTML += '<div class="admin-left-stack">';
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 0, 'Item 1');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 1, 'Item 2');
                areasHTML += '</div>'; // Close admin-left-stack
                
                // Right item (50%)
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 2, 'Item 3');
            } else if (row.layout === '70-15-15') {
                // Hero + Grid layout: Large left, stacked right
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 0, 'Feature');
                
                // Right stack container
                areasHTML += '<div class="admin-right-stack">';
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 1, 'Small 1');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 2, 'Small 2');
                areasHTML += '</div>';
            } else if (row.layout === 'irregular-6') {
                // Pinterest Style (5) layout
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 0, 'Feature');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 1, 'Item 2');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 2, 'Item 3');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 3, 'Item 4');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 4, 'Item 5');
            } else if (row.layout === 'two-row-6') {
                // Two Row Grid (6) layout
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 0, 'Hero');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 1, 'Tall');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 2, 'Top');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 3, 'Left');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 4, 'Right');
                areasHTML += this.createLayoutAreaHTML(row, rowIndex, 5, 'Bottom');
            } else {
                // Standard layout handling for remaining layouts
                for (let i = 0; i < layout.items; i++) {
                    areasHTML += this.createLayoutAreaHTML(row, rowIndex, i);
                }
            }
            
            areasHTML += '</div>';
            return areasHTML;
        }

        getAreaContentDisplay(item) {
            if (item.type === 'empty') {
                return `<div class="empty-space-label" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 12px; opacity: 0.5;">Empty Space</div>`;
            } else if (item.type === 'image' && item.content) {
                return `<img src="${item.content}" alt="Layout item" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else if (item.type === 'video' && item.content) {
                // For admin preview, show thumbnail using the simple /thumbnail pattern
                const videoId = `admin-video-${Math.random().toString(36).substr(2, 9)}`;
                
                // Load thumbnail asynchronously using the video URL
                setTimeout(async () => {
                    // Create fake asset data structure with the video URL
                    const fakeAssetData = { assetUrl: item.content };
                    const thumbnailUrl = await this.getVideoThumbnail(fakeAssetData);
                    const element = document.getElementById(videoId);
                    if (element) {
                        if (thumbnailUrl) {
                            element.style.backgroundImage = `url(${thumbnailUrl})`;
                            element.style.backgroundSize = 'cover';
                            element.style.backgroundPosition = 'center';
                            element.innerHTML = '<div class="video-thumbnail-overlay"><svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_35469_18153)"><path d="M1.8999 18.9999C1.8999 28.444 9.55584 36.0999 18.9999 36.0999C28.444 36.0999 36.0999 28.444 36.0999 18.9999C36.0999 9.55584 28.444 1.8999 18.9999 1.8999C9.55584 1.8999 1.8999 9.55584 1.8999 18.9999Z" stroke="white" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.2 24.7V13.3L24.7 19L15.2 24.7Z" stroke="white" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_35469_18153"><rect width="38" height="38" fill="white"/></clipPath></defs></svg></div>';
                        } else {
                            // Fallback if thumbnail loading fails
                            element.style.background = '#f0f0f0';
                            element.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 24px; color: #666;"><svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_35469_18153)"><path d="M1.8999 18.9999C1.8999 28.444 9.55584 36.0999 18.9999 36.0999C28.444 36.0999 36.0999 28.444 36.0999 18.9999C36.0999 9.55584 28.444 1.8999 18.9999 1.8999C9.55584 1.8999 1.8999 9.55584 1.8999 18.9999Z" stroke="#666" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.2 24.7V13.3L24.7 19L15.2 24.7Z" stroke="#666" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_35469_18153"><rect width="38" height="38" fill="white"/></clipPath></defs></svg></div>';
                        }
                    }
                }, 100);
                
                return `<div id="${videoId}" class="video-thumbnail-container" style="width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #666;">Loading thumbnail...</div>`;
            } else {
                return `<div class="placeholder-content">${item.content || 'Empty'}</div>`;
            }
        }

        createAreaOverlay(rowIndex, itemIndex, item = null) {
            // Don't add overlay for empty space items
            if (item && item.type === 'empty') {
                return '';
            }
            
            const hasContent = item && item.type !== 'placeholder' && item.content;
            
            return `
                <div class="area-overlay">
                    <button class="area-menu-btn" data-row="${rowIndex}" data-item="${itemIndex}" title="Media options">
                        <svg width="31" height="20" viewBox="0 0 31 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1.00005 16.0001C1 15.9355 1 15.8689 1 15.8002V4.2002C1 3.08009 1 2.51962 1.21799 2.0918C1.40973 1.71547 1.71547 1.40973 2.0918 1.21799C2.51962 1 3.08009 1 4.2002 1H15.8002C16.9203 1 17.4801 1 17.9079 1.21799C18.2842 1.40973 18.5905 1.71547 18.7822 2.0918C19 2.5192 19 3.07899 19 4.19691V15.8031C19 16.2881 19 16.6679 18.9822 16.9774M1.00005 16.0001C1.00082 16.9884 1.01337 17.5058 1.21799 17.9074C1.40973 18.2837 1.71547 18.5905 2.0918 18.7822C2.5192 19 3.07899 19 4.19691 19H15.8036C16.9215 19 17.4805 19 17.9079 18.7822C18.2842 18.5905 18.5905 18.2837 18.7822 17.9074C18.9055 17.6654 18.959 17.3813 18.9822 16.9774M1.00005 16.0001L5.76798 10.4375L5.76939 10.436C6.19227 9.9426 6.40406 9.69551 6.65527 9.60645C6.87594 9.52821 7.11686 9.53004 7.33643 9.61133C7.58664 9.70397 7.79506 9.95387 8.21191 10.4541L10.8831 13.6595C11.269 14.1226 11.463 14.3554 11.6986 14.4489C11.9065 14.5313 12.1357 14.5406 12.3501 14.4773C12.5942 14.4053 12.8091 14.1904 13.2388 13.7607L13.7358 13.2637C14.1733 12.8262 14.3921 12.6076 14.6397 12.5361C14.8571 12.4734 15.0896 12.4869 15.2988 12.5732C15.537 12.6716 15.7302 12.9124 16.1167 13.3955L18.9822 16.9774M18.9822 16.9774L19 16.9996M13 7C12.4477 7 12 6.55228 12 6C12 5.44772 12.4477 5 13 5C13.5523 5 14 5.44772 14 6C14 6.55228 13.5523 7 13 7Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M24 10H30M27 13V7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="area-context-menu" data-row="${rowIndex}" data-item="${itemIndex}">
                        <button class="area-menu-item area-btn-library" data-row="${rowIndex}" data-item="${itemIndex}">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13 14C13 14.5523 13.4477 15 14 15C14.5523 15 15 14.5523 15 14C15 13.4477 14.5523 13 14 13C13.4477 13 13 13.4477 13 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M7 14C7 14.5523 7.44772 15 8 15C8.55228 15 9 14.5523 9 14C9 13.4477 8.55228 13 8 13C7.44772 13 7 13.4477 7 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M1 14C1 14.5523 1.44772 15 2 15C2.55228 15 3 14.5523 3 14C3 13.4477 2.55228 13 2 13C1.44772 13 1 13.4477 1 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M13 8C13 8.55228 13.4477 9 14 9C14.5523 9 15 8.55228 15 8C15 7.44772 14.5523 7 14 7C13.4477 7 13 7.44772 13 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M7 8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M1 8C1 8.55228 1.44772 9 2 9C2.55228 9 3 8.55228 3 8C3 7.44772 2.55228 7 2 7C1.44772 7 1 7.44772 1 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M13 2C13 2.55228 13.4477 3 14 3C14.5523 3 15 2.55228 15 2C15 1.44772 14.5523 1 14 1C13.4477 1 13 1.44772 13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M7 2C7 2.55228 7.44772 3 8 3C8.55228 3 9 2.55228 9 2C9 1.44772 8.55228 1 8 1C7.44772 1 7 1.44772 7 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M1 2C1 2.55228 1.44772 3 2 3C2.55228 3 3 2.55228 3 2C3 1.44772 2.55228 1 2 1C1.44772 1 1 1.44772 1 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Select from Library</span>
                        </button>
                        <button class="area-menu-item area-btn-upload" data-row="${rowIndex}" data-item="${itemIndex}">
                            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 16V13M8 13V10M8 13H5M8 13H11M9 1.00087C8.90451 1 8.79728 1 8.67471 1H4.2002C3.08009 1 2.51962 1 2.0918 1.21799C1.71547 1.40973 1.40973 1.71547 1.21799 2.0918C1 2.51962 1 3.08009 1 4.2002V15.8002C1 16.9203 1 17.4801 1.21799 17.9079C1.40973 18.2842 1.71547 18.5905 2.0918 18.7822C2.51921 19 3.079 19 4.19694 19L11.8031 19C12.921 19 13.48 19 13.9074 18.7822C14.2837 18.5905 14.5905 18.2842 14.7822 17.9079C15 17.4805 15 16.9215 15 15.8036V7.32568C15 7.20296 15 7.09561 14.9991 7M9 1.00087C9.28564 1.00347 9.46634 1.01385 9.63884 1.05526C9.84291 1.10425 10.0379 1.18526 10.2168 1.29492C10.4186 1.41857 10.5918 1.59182 10.9375 1.9375L14.063 5.06298C14.4089 5.40889 14.5809 5.58136 14.7046 5.78319C14.8142 5.96214 14.8953 6.15726 14.9443 6.36133C14.9857 6.53376 14.9963 6.71451 14.9991 7M9 1.00087V3.8C9 4.9201 9 5.47977 9.21799 5.90759C9.40973 6.28392 9.71547 6.59048 10.0918 6.78223C10.5192 7 11.079 7 12.1969 7H14.9991M14.9991 7H15.0002" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Upload File</span>
                        </button>
                        ${hasContent ? `
                            <button class="area-menu-item area-btn-remove" data-row="${rowIndex}" data-item="${itemIndex}">
                                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 1H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4M6.66667 7.5V10.5M9.33333 7.5V10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Remove Media</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        toggleLayoutDropdown(rowIndex) {
            const dropdown = document.getElementById(`layout-dropdown-${rowIndex}`);
            const selector = dropdown.closest('.visual-layout-selector');
            const arrow = selector.querySelector('.dropdown-arrow');
            const isOpen = dropdown.classList.contains('open');
            
            // Close all other dropdowns and reset arrows
            document.querySelectorAll('.layout-dropdown').forEach(dd => {
                dd.classList.remove('open');
                const otherArrow = dd.closest('.visual-layout-selector').querySelector('.dropdown-arrow');
                otherArrow.style.transform = 'rotate(0deg)';
            });
            
            // Toggle this dropdown
            if (!isOpen) {
                dropdown.classList.add('open');
                arrow.style.transform = 'rotate(180deg)';
            }
        }

        selectLayoutFromDropdown(layoutId, rowIndex) {
            this.updateRowLayout(rowIndex, layoutId);
            
            // Update the selected state in the dropdown options
            const dropdownElement = document.getElementById(`layout-dropdown-${rowIndex}`);
            if (dropdownElement) {
                // Remove selected class from all options
                dropdownElement.querySelectorAll('.layout-option-dropdown').forEach(option => {
                    option.classList.remove('selected');
                });
                
                // Add selected class to the chosen layout
                const selectedOption = dropdownElement.querySelector(`[data-layout="${layoutId}"]`);
                if (selectedOption) {
                    selectedOption.classList.add('selected');
                }
            }
            
            // Update the current layout display in the form (inside the accordion)
            const layoutSelector = document.querySelector(`.visual-layout-selector[data-row-index="${rowIndex}"]`);
            if (layoutSelector) {
                const previewElement = layoutSelector.querySelector('.layout-preview');
                const nameElement = layoutSelector.querySelector('.layout-name');
                
                if (previewElement) {
                    previewElement.innerHTML = this.createLayoutPreview(layoutId);
                }
                if (nameElement) {
                    nameElement.textContent = this.getLayoutName(layoutId);
                }
            }
            
            // Also update the layout preview in the accordion header (the main visible one)
            const accordionItem = document.querySelector(`.accordion-item[data-row-index="${rowIndex}"]`);
            if (accordionItem) {
                const headerPreview = accordionItem.querySelector('.accordion-header .layout-preview');
                const headerLabel = accordionItem.querySelector('.accordion-header .row-label');
                
                if (headerPreview) {
                    headerPreview.innerHTML = this.createLayoutPreview(layoutId);
                }
                if (headerLabel) {
                    const layoutName = this.getLayoutName(layoutId);
                    const isDraft = this.gridData[rowIndex] && this.gridData[rowIndex].isDraft;
                    headerLabel.textContent = `${layoutName}${isDraft ? ' (draft)' : ''}`;
                }
            }
            
            // Properly close the dropdown using the existing toggle method
            const dropdown = document.getElementById(`layout-dropdown-${rowIndex}`);
            if (dropdown && dropdown.classList.contains('open')) {
                this.toggleLayoutDropdown(rowIndex);
            }
        }

        async selectFromLibrary(rowIndex, itemIndex) {
            // Close the option modal
            document.querySelector('.asset-modal-overlay')?.remove();

            // Show drawer immediately with loading state
            this.showAssetSelectorDrawer(null, rowIndex, itemIndex);

            try {
                const crumb = this.getCdnEdgeToken();
                if (!crumb) {
                    throw new Error('Could not get authentication token. Ensure logged into Squarespace admin.');
                }

                const websiteId = await this.getWebsiteId(crumb);
                if (!websiteId) {
                    throw new Error('Could not determine website ID.');
                }

                // Check if we already have media API access
                const hasExistingAccess = await this.checkExistingMediaAccess(websiteId);
                
                if (!hasExistingAccess) {
                    const authData = await this.getAssetLibraryAuth(crumb);
                    
                    if (!authData) {
                        throw new Error('Could not get asset library authorization token.');
                    }
                    
                    // Store the Bearer token for browsing asset library
                    this.assetLibraryToken = authData.token;
                    
                    // Also get asset auth token for video playback
                    const assetAuthData = await this.getAssetAuth(crumb);
                    if (assetAuthData && assetAuthData.token) {
                        this.assetAuthToken = assetAuthData.token;
                        console.log('🎬 Got asset authorization token for video playback from library');
                    }
                }

                const mediaAssets = await this.listAssetLibraryMedia(websiteId, crumb, { limit: 500 });

                if (mediaAssets.length === 0) {
                    throw new Error('No media assets found in your asset library.');
                }

                // Update drawer with actual assets
                this.updateAssetDrawerContent(mediaAssets, rowIndex, itemIndex);

            } catch (error) {
                // Update drawer to show error state
                this.showAssetDrawerError(error.message);
                console.error('Asset library error:', error);
            }
        }

        uploadFile(rowIndex, itemIndex) {
            this.uploadNewImage(rowIndex, itemIndex);
        }

        uploadToAssetLibrary() {
            // Don't close the asset drawer - we want to stay in the library
            console.log('🎬 Starting upload to asset library...');
            
            // Create and trigger file input IMMEDIATELY while event is still "trusted"
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,video/*';
            fileInput.style.display = 'none';

            fileInput.onchange = async (inputEvent) => {
                const file = inputEvent.target.files[0];
                if (!file) {
                    document.body.removeChild(fileInput);
                    return;
                }
                
                console.log(`🎬 Selected file for library: ${file.name}`);
                
                try {
                    // Show uploading placeholder in asset library
                    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
                    const uploadPlaceholder = this.createUploadingPlaceholder(file.name, fileType);
                    this.addUploadPlaceholderToLibrary(uploadPlaceholder);
                    
                    // Get required tokens
                    const crumbToken = this.getCdnEdgeToken();
                    if (!crumbToken) {
                        throw new Error('Could not retrieve CSRF token.');
                    }
                    
                    const libraryId = await this.getWebsiteId(crumbToken);
                    if (!libraryId) {
                        throw new Error('Could not retrieve Website ID.');
                    }
                    
                    // Get asset authorization for video playback authentication
                    if (!this.assetAuthToken) {
                        const assetAuthData = await this.getAssetAuth(crumbToken);
                        if (assetAuthData && assetAuthData.token) {
                            this.assetAuthToken = assetAuthData.token;
                            console.log('🎬 Got asset authorization token for video playback');
                        }
                    }
                    
                    // Execute the three-step upload process
                    const isVideo = file.type.startsWith('video/');
                    const jobId = await this.uploadRawMediaFile(file, libraryId);
                    if (!jobId) {
                        throw new Error(`Failed to upload raw ${isVideo ? 'video' : 'image'} file.`);
                    }
                    
                    const assetId = await this.pollForAssetId(jobId, isVideo);
                    if (!assetId) {
                        throw new Error('Failed to get asset ID after upload.');
                    }
                    
                    let assetInfo;
                    if (isVideo) {
                        // For videos, construct the asset info directly - no Step 3 needed
                        console.log('Video upload complete! Constructing asset info directly...');
                        assetInfo = {
                            id: assetId,
                            assetUrl: `https://video.squarespace-cdn.com/content/v1/${libraryId}/${assetId}/{variant}`
                        };
                        
                        // Activate the newly uploaded video via lesson service
                        console.log('🎬 📚 Activating newly uploaded video via lesson service...');
                        try {
                            await this.performFauxSectionSave(assetId, crumbToken, file.name);
                        } catch (error) {
                            console.warn('🎬 ⚠️  Video activation failed, but upload was successful:', error);
                        }
                    } else {
                        // For images, we still need Step 3
                        assetInfo = await this.referenceAssetInLibrary(assetId, libraryId, crumbToken, isVideo);
                        if (!assetInfo) {
                            throw new Error('Failed to reference asset in library.');
                        }
                    }
                    
                    // Replace the placeholder with the actual uploaded asset
                    this.replaceUploadPlaceholderWithAsset(uploadPlaceholder, assetInfo, file.name, isVideo);
                    
                    console.log('🎬 Upload to library complete!');
                    
                } catch (error) {
                    console.error('Upload to library failed:', error);
                    // Remove the placeholder on error
                    document.querySelector('.upload-placeholder')?.remove();
                    alert('Upload failed: ' + error.message);
                } finally {
                    // Clean up file input
                    document.body.removeChild(fileInput);
                }
            };

            // Add to DOM and trigger
            document.body.appendChild(fileInput);
            fileInput.click();
        }

        createUploadingPlaceholder(fileName, fileType) {
            const placeholder = document.createElement('div');
            placeholder.className = 'asset-grid-item upload-placeholder';
            placeholder.innerHTML = `
                <div class="asset-thumbnail">
                    <div class="upload-progress">
                        <div class="loading-spinner"></div>
                        <div class="upload-status">
                            <div class="upload-text">Uploading ${fileType}...</div>
                            <div class="upload-filename">${fileName}</div>
                        </div>
                    </div>
                </div>
                <div class="asset-info">
                    <p class="asset-filename">${fileName}</p>
                </div>
            `;
            return placeholder;
        }

        addUploadPlaceholderToLibrary(placeholder) {
            const assetGrid = document.querySelector('.asset-drawer .asset-grid');
            if (assetGrid) {
                // Insert at the beginning of the grid
                assetGrid.insertBefore(placeholder, assetGrid.firstChild);
            }
        }

        replaceUploadPlaceholderWithAsset(placeholder, assetInfo, fileName, isVideo) {
            if (!placeholder || !placeholder.parentNode) return;
            
            // Create the new asset element with proper data attributes
            const newAsset = document.createElement('div');
            const assetTypeClass = isVideo ? 'video-asset' : 'image-asset';
            
            // Get the drawer context
            const drawer = document.querySelector('.asset-drawer');
            const rowIndex = parseInt(drawer.dataset.rowIndex);
            const itemIndex = parseInt(drawer.dataset.itemIndex);
            
            // Create a temporary asset object to add to the current assets array
            const newAssetData = {
                assetUrl: assetInfo.assetUrl,
                assetType: isVideo ? 'VIDEO' : 'IMAGE',
                filename: fileName,
                stringMetaData: { fileName: fileName },
                title: fileName,
                id: assetInfo.id
            };
            
            // Add the new asset to the beginning of the current assets array
            if (this.currentMediaAssets) {
                this.currentMediaAssets.unshift(newAssetData);
                // Also update filtered assets if they exist
                if (this.filteredAssets) {
                    this.filteredAssets.unshift(newAssetData);
                }
            }
            
            // Set the proper class and data attributes for event delegation
            newAsset.className = `asset-grid-item ${assetTypeClass}`;
            newAsset.setAttribute('data-asset-index', '0'); // It's now at index 0
            newAsset.setAttribute('data-row-index', rowIndex);
            newAsset.setAttribute('data-item-index', itemIndex);
                
            const thumbnailUrl = isVideo 
                ? assetInfo.assetUrl.replace('{variant}', 'poster')
                : assetInfo.assetUrl;
                
            const videoOverlay = isVideo ? `<div class="video-play-overlay">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 14.3336V3.66698C1 2.78742 1 2.34715 1.18509 2.08691C1.34664 1.85977 1.59564 1.71064 1.87207 1.67499C2.18868 1.63415 2.57701 1.84126 3.35254 2.25487L13.3525 7.58821L13.3562 7.58982C14.2132 8.04692 14.642 8.27557 14.7826 8.58033C14.9053 8.84619 14.9053 9.15308 14.7826 9.41894C14.6418 9.72413 14.212 9.95371 13.3525 10.4121L3.35254 15.7454C2.57645 16.1593 2.1888 16.3657 1.87207 16.3248C1.59564 16.2891 1.34664 16.1401 1.18509 15.9129C1 15.6527 1 15.2132 1 14.3336Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>` : '';
                
            newAsset.innerHTML = `
                <div class="asset-thumbnail">
                    <img src="${thumbnailUrl}" alt="${fileName}" loading="lazy">
                    ${videoOverlay}
                </div>
                <div class="asset-info">
                    <span class="asset-filename">${fileName}</span>
                </div>
            `;
            
            // Replace the placeholder with the new asset
            placeholder.parentNode.replaceChild(newAsset, placeholder);
            
            // Update all existing asset indices since we inserted at the beginning
            const assetGrid = document.querySelector('.asset-drawer .asset-grid');
            const existingAssets = assetGrid.querySelectorAll('.asset-grid-item:not(.upload-placeholder)');
            existingAssets.forEach((asset, index) => {
                if (asset !== newAsset) {
                    asset.setAttribute('data-asset-index', index);
                }
            });
        }

        async refreshAssetLibrary() {
            const drawer = document.querySelector('.asset-drawer');
            if (!drawer) return;
            
            // Get the current row and item indexes from the drawer's dataset
            const rowIndex = parseInt(drawer.dataset.rowIndex);
            const itemIndex = parseInt(drawer.dataset.itemIndex);
            
            // Clear the asset cache to force a fresh fetch
            this.assetCache = null;
            
            // Re-run the filter and sort to refresh the content
            await this.filterAndSortAssets(drawer, rowIndex, itemIndex);
        }

        uploadNewImage(rowIndex, itemIndex) {
            // Close the option modal
            document.querySelector('.asset-modal-overlay')?.remove();
            
            console.log('🎬 Starting SAFE file upload process for:', rowIndex, itemIndex);
            
            // Hybrid approach - trigger file picker immediately while event is still "trusted"
            // DON'T prevent default on mousedown - let it be "trusted"
            // Only stop propagation to prevent bubbling
            
            // Create and trigger file input IMMEDIATELY while event is still "trusted"
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,video/*';
            fileInput.style.display = 'none';

            fileInput.onchange = async (inputEvent) => {
                const file = inputEvent.target.files[0];
                if (!file) {
                    document.body.removeChild(fileInput);
                    return;
                }
                
                console.log(`🎬 Selected file: ${file.name}`);
                
                try {
                    // Show loading state
                    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
                    const loadingOverlay = this.createLoadingOverlay(`Uploading ${fileType}...`);
                    document.body.appendChild(loadingOverlay);
                    
                    // Get required tokens
                    const crumbToken = this.getCdnEdgeToken();
                    if (!crumbToken) {
                        throw new Error('Could not retrieve CSRF token.');
                    }
                    
                    const libraryId = await this.getWebsiteId(crumbToken);
                    if (!libraryId) {
                        throw new Error('Could not retrieve Website ID.');
                    }
                    
                    // Get asset authorization for video playback authentication
                    if (!this.assetAuthToken) {
                        const assetAuthData = await this.getAssetAuth(crumbToken);
                        if (assetAuthData && assetAuthData.token) {
                            this.assetAuthToken = assetAuthData.token;
                            console.log('🎬 Got asset authorization token for video playback');
                        }
                    }
                    
                    // Execute the three-step upload process
                    const isVideo = file.type.startsWith('video/');
                    const jobId = await this.uploadRawMediaFile(file, libraryId);
                    if (!jobId) {
                        throw new Error(`Failed to upload raw ${isVideo ? 'video' : 'image'} file.`);
                    }
                    
                    const assetId = await this.pollForAssetId(jobId, isVideo);
                    if (!assetId) {
                        throw new Error('Failed to get asset ID after upload.');
                    }
                    
                    let assetInfo;
                    if (isVideo) {
                        // For videos, construct the asset info directly - no Step 3 needed
                        console.log('Video upload complete! Constructing asset info directly...');
                        assetInfo = {
                            id: assetId,
                            assetUrl: `https://video.squarespace-cdn.com/content/v1/${libraryId}/${assetId}/{variant}`
                        };
                        
                        // Activate the newly uploaded video via lesson service
                        console.log('🎬 📚 Activating newly uploaded video via lesson service...');
                        try {
                            await this.performFauxSectionSave(assetId, crumbToken, file.name);
                        } catch (error) {
                            console.warn('🎬 ⚠️  Video activation failed, but upload was successful:', error);
                        }
                    } else {
                        // For images, we still need Step 3
                        assetInfo = await this.referenceAssetInLibrary(assetId, libraryId, crumbToken, isVideo);
                        if (!assetInfo) {
                            throw new Error('Failed to reference asset in library.');
                        }
                    }
                    
                    // Update the grid item with the appropriate type based on file
                    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
                    this.gridData[rowIndex].items[itemIndex] = {
                        type: mediaType,
                        content: assetInfo.assetUrl
                    };
                    
                    // Save accordion states and scroll position BEFORE re-rendering
                    const accordionStates = this.saveDetailedAccordionStates();
                    const currentScrollTop = document.querySelector('.admin-left-column')?.scrollTop || 0;
                    
                    // Re-render and save
                    this.renderGrid();
                    this.renderAdminForm();
                    this.markAsChanged();
                    
                    // Restore accordion states and scroll position with proper timing
                    setTimeout(() => {
                        this.restoreDetailedAccordionStates(accordionStates);
                        // Restore scroll position
                        const adminColumn = document.querySelector('.admin-left-column');
                        if (adminColumn) {
                            adminColumn.scrollTop = currentScrollTop;
                        }
                    }, 50);
                    
                    // Remove loading overlay
                    loadingOverlay.remove();
                    
                    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully!`, assetInfo);
                    
                } catch (error) {
                    console.error('Upload failed:', error);
                    alert(`Upload failed: ${error.message}`);
                    
                    // Remove loading overlay if it exists
                    document.querySelector('.upload-loading-overlay')?.remove();
                }
                
                document.body.removeChild(fileInput);
            };
            
            fileInput.onerror = () => {
                document.body.removeChild(fileInput);
            };
            
            // Add to DOM and trigger immediately while still in trusted event context
            document.body.appendChild(fileInput);
            
            // Use setTimeout to trigger after mousedown is fully processed but still trusted
            setTimeout(() => {
                try {
                    fileInput.click();
                } catch (e) {
                    console.error('File input click failed:', e);
                    // Fallback: try to trigger with dispatchEvent
                    const clickEvent = new MouseEvent('click', {
                        bubbles: false,
                        cancelable: true
                    });
                    fileInput.dispatchEvent(clickEvent);
                }
            }, 0); // Use 0ms delay instead of 100ms
        }

        removeImage(rowIndex, itemIndex) {
            // Reset the item to placeholder
            if (!this.gridData[rowIndex] || !this.gridData[rowIndex].items) return;
            
            // Save accordion states and scroll position BEFORE making changes
            const accordionStates = this.saveDetailedAccordionStates();
            const currentScrollTop = document.querySelector('.admin-left-column')?.scrollTop || 0;
            
            this.gridData[rowIndex].items[itemIndex] = { 
                type: 'placeholder', 
                content: `Item ${itemIndex + 1}` 
            };
            
            // Re-render the grid and admin interface
            this.renderGrid();
            this.renderAdminForm();
            this.markAsChanged();
            
            // Restore accordion states and scroll position with proper timing
            setTimeout(() => {
                this.restoreDetailedAccordionStates(accordionStates);
                // Restore scroll position
                const adminColumn = document.querySelector('.admin-left-column');
                if (adminColumn) {
                    adminColumn.scrollTop = currentScrollTop;
                }
            }, 50);
        }

        toggleAreaContextMenu(rowIndex, itemIndex, event) {
            // Close any open context menus first
            this.closeAllAreaContextMenus();
            
            // Find the context menu for this specific area
            const contextMenu = document.querySelector(`.area-context-menu[data-row="${rowIndex}"][data-item="${itemIndex}"]`);
            if (!contextMenu) return;
            
            // Position the context menu centered on the layout area but able to overflow
            const button = event.target.closest('.area-menu-btn');
            const layoutArea = button.closest('.layout-area');
            const areaRect = layoutArea.getBoundingClientRect();
            
            // Calculate center position of the layout area
            const centerX = areaRect.left + (areaRect.width / 2);
            const centerY = areaRect.top + (areaRect.height / 2);
            
            // Position menu at center with fixed positioning (can overflow)
            contextMenu.style.position = 'fixed';
            contextMenu.style.left = `${centerX}px`;
            contextMenu.style.top = `${centerY}px`;
            contextMenu.style.transform = 'translate(-50%, -50%)';
            contextMenu.style.zIndex = '10000';
            
            // Show the context menu
            contextMenu.classList.add('active');
            
        }
        
        closeAllAreaContextMenus() {
            document.querySelectorAll('.area-context-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }

        // --- UPLOAD HELPER FUNCTIONS ---

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async getWebsiteId(crumbToken) {
            console.log("Attempting to retrieve Website ID...");
            try {
                const apiUrl = `${window.location.origin}/api/commondata/GetCollections`;
                const response = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "x-csrf-token": crumbToken
                    },
                    credentials: "include"
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch collections data: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data && data.collections && Object.keys(data.collections).length > 0) {
                    const firstCollectionKey = Object.keys(data.collections)[0];
                    const websiteId = data.collections[firstCollectionKey].websiteId;
                    if (websiteId) {
                        console.log(`Website ID successfully retrieved: ${websiteId}`);
                        return websiteId;
                    }
                }
                console.error("Could not find websiteId within the GetCollections response.");
                return null;
            } catch (error) {
                console.error("Error retrieving Website ID:", error);
                return null;
            }
        }

        // Step 1: Upload the raw image file to media-api.squarespace.com
        async uploadRawMediaFile(file, libraryId) {
            const isVideo = file.type.startsWith('video/');
            const endpoint = isVideo ? 'video' : 'image';
            
            console.log(`Step 1: Uploading raw ${endpoint} "${file.name}" to media-api.squarespace.com/uploads/${endpoint}...`);
            try {
                const formData = new FormData();
                // Note: Both image and video uploads use "image" as the form field name
                formData.append("image", file, file.name);
                // Don't add specific folderId - let it go to default location

                const uploadResponse = await fetch(`https://media-api.squarespace.com/uploads/${endpoint}`, {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "x-library-id": libraryId,
                        "x-sqsp-source": "web upload"
                    },
                    body: formData,
                    credentials: "include",
                    mode: "cors"
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Raw ${endpoint} upload failed: HTTP status ${uploadResponse.status}. Response: ${await uploadResponse.text()}`);
                }

                const result = await uploadResponse.json();
                console.log(`Step 1 successful! ${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)} Job Info:`, result);

                if (result && result.jobId) {
                    return result.jobId;
                } else {
                    console.warn(`Step 1 response did not contain expected jobId. Full ${endpoint} response:`, result);
                    return null;
                }

            } catch (error) {
                console.error("Error during Step 1 (raw media upload):", error);
                return null;
            }
        }

        // Step 2: Poll for job status to get the asset ID
        async pollForAssetId(jobIdFromStep1, isVideo = false) {
            const endpoint = isVideo ? 'video' : 'image';
            console.log(`Step 2: Polling for ${endpoint} asset ID...`);
            const POLLING_INTERVAL_MS = isVideo ? 3000 : 1000; // 3 seconds for videos, 1 second for images
            const POLLING_MAX_ATTEMPTS = isVideo ? Infinity : 30; // No limit for videos, 30 seconds for images
            let attempts = 0;

            while (attempts < POLLING_MAX_ATTEMPTS) {
                await this.sleep(POLLING_INTERVAL_MS);
                attempts++;
                console.log(`Polling attempt ${attempts}...`);

                try {
                    const statusUrl = `https://media-api.squarespace.com/jobs/${endpoint}/status?job-list=${encodeURIComponent(jobIdFromStep1)}`;

                    const statusResponse = await fetch(statusUrl, {
                        method: "GET",
                        headers: {
                            "accept": "application/json, text/plain, */*",
                        },
                        credentials: "omit",
                        mode: "cors"
                    });

                    if (!statusResponse.ok) {
                        console.warn(`Polling status failed: HTTP status ${statusResponse.status}. Retrying...`);
                        continue;
                    }

                    const statusResult = await statusResponse.json();

                    if (Array.isArray(statusResult) && statusResult.length > 0) {
                        const jobDetails = statusResult.find(job => job.id === jobIdFromStep1);

                        if (jobDetails) {
                            if (jobDetails.isSuccess === true && jobDetails.status === 3 && jobDetails.assetId) {
                                console.log(`Step 2 successful! Job completed, received assetId: ${jobDetails.assetId}`);
                                return jobDetails.assetId;
                            } else if (jobDetails.isSuccess === false || jobDetails.status !== 3) {
                                if (jobDetails.error) {
                                    throw new Error(`Job processing failed with error: ${jobDetails.error.message || "Unknown error"}`);
                                }
                            }
                        } else {
                            console.warn("Job ID not found in polling response array. Continuing to poll...");
                        }
                    } else {
                        console.warn("Unexpected polling response structure. Continuing to poll...");
                    }

                } catch (error) {
                    console.error(`Error during Step 2 (polling for asset ID):`, error);
                }
            }

            if (isVideo) {
                console.error(`Step 2 failed: Video processing appears to have failed after ${attempts} attempts.`);
            } else {
                console.error(`Step 2 failed: Max polling attempts (${POLLING_MAX_ATTEMPTS}) reached. Asset ID not found.`);
            }
            return null;
        }

        // Step 3: Reference/Activate the uploaded asset within the site's asset library
        async referenceAssetInLibrary(assetId, libraryId, crumbToken, isVideo = false) {
            const mediaType = isVideo ? 'video' : 'image';
            console.log(`Step 3: Referencing ${mediaType} asset ID "${assetId}" in asset library...`);
            try {
                const postData = {
                    assetId: assetId,
                    libraryId: libraryId,
                    recordType: isVideo ? 10 : 2 // 10 for video, 2 for image
                };

                const endpoint = isVideo ? 'videos' : 'images';
                const referenceUrl = `${window.location.origin}/api/uploads/${endpoint}/asset-reference?crumb=${encodeURIComponent(crumbToken)}`;

                const referenceResponse = await fetch(referenceUrl, {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "content-type": "application/x-www-form-urlencoded",
                        "x-csrf-token": crumbToken,
                        "x-requested-with": "XMLHttpRequest"
                    },
                    body: new URLSearchParams(postData),
                    credentials: "include",
                    mode: "cors"
                });

                if (!referenceResponse.ok) {
                    if (isVideo && referenceResponse.status === 404) {
                        console.log('Video asset reference endpoint not found (404) - this may be expected for videos');
                        return null;
                    }
                    throw new Error(`Asset reference failed: HTTP status ${referenceResponse.status}. Response: ${await referenceResponse.text()}`);
                }

                const result = await referenceResponse.json();
                const assetInfo = result.media && result.media.length > 0 ? result.media[0] : null;

                if (assetInfo && assetInfo.id && assetInfo.assetUrl) {
                    console.log("Step 3 successful! Asset is now referenced and available in library.");
                    return assetInfo;
                } else {
                    console.warn("Step 3 response did not contain expected asset ID or assetUrl in result.media[0]. Full response:", result);
                    return null;
                }

            } catch (error) {
                console.error("Error during Step 3 (asset reference):", error);
                return null;
            }
        }

        createLoadingOverlay(message) {
            const overlay = document.createElement('div');
            overlay.className = 'upload-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 18px;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: #333;
                padding: 30px;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;
            
            content.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <div style="width: 40px; height: 40px; border: 3px solid #555; border-top: 3px solid #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <div>${message}</div>
            `;
            
            // Add CSS animation
            if (!document.querySelector('#upload-spinner-styles')) {
                const style = document.createElement('style');
                style.id = 'upload-spinner-styles';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            overlay.appendChild(content);
            return overlay;
        }

        createLoadingModal(message) {
            const modal = document.createElement('div');
            modal.className = 'asset-modal-overlay';
            modal.innerHTML = `
                <div class="asset-modal loading-modal">
                    <div class="loading-spinner"></div>
                    <p class="loading-message">${message}</p>
                </div>
            `;
            return modal;
        }

        updateLoadingModal(modal, message) {
            const messageEl = modal.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }

        showErrorModal(title, message) {
            const modal = document.createElement('div');
            modal.className = 'asset-modal-overlay';
            modal.innerHTML = `
                <div class="asset-modal error-modal">
                    <div class="asset-modal-header">
                        <h3>${title}</h3>
                        <button class="asset-modal-close" >✕</button>
                    </div>
                    <div class="asset-modal-content">
                        <p>${message}</p>
                        <button class="btn btn-primary" >OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        showAssetSelectorDrawer(mediaAssets, rowIndex, itemIndex) {
            // Store the media assets for selection (null if loading)
            this.currentMediaAssets = mediaAssets;
            this.filteredAssets = mediaAssets ? this.sortAssets(mediaAssets, 'date-desc') : mediaAssets; // Apply default sort
            
            const drawer = document.createElement('div');
            drawer.className = 'asset-drawer-overlay';
            drawer.innerHTML = `
                <div class="asset-drawer" data-row-index="${rowIndex}" data-item-index="${itemIndex}">
                    <div class="asset-drawer-header">
                        <h3>Select Media from Asset Library</h3>
                        <div class="asset-drawer-header-actions">
                            <button class="asset-drawer-upload" title="Upload New Image">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M7 10L12 5L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 5V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Upload
                            </button>
                            <button class="asset-drawer-close" >✕</button>
                        </div>
                    </div>
                    <div class="asset-drawer-controls">
                        <div class="search-container">
                            <input type="text" class="asset-search" placeholder="Search by filename or keywords..." />
                            <div class="search-icon">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M13 13L19 19M8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                        <div class="filter-container">
                            <select class="asset-filter">
                                <option value="all">All Media</option>
                                <option value="image">Images Only</option>
                                <option value="video">Videos Only</option>
                                <option value="unused">Unused in Gallery</option>
                                <option value="used">Used in Gallery</option>
                            </select>
                        </div>
                        <div class="sort-container">
                            <select class="asset-sort">
                                <option value="date-desc">Newest First</option>
                                <option value="date-asc">Oldest First</option>
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                            </select>
                        </div>
                        <div class="results-count">
                            <span class="asset-count">${mediaAssets ? mediaAssets.length : 0} assets</span>
                        </div>
                    </div>
                    <div class="asset-drawer-content">
                        <div class="asset-grid">
                            ${mediaAssets ? this.createAssetGrid(this.filteredAssets, rowIndex, itemIndex) : this.createSkeletonLoaders()}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(drawer);

            // NUCLEAR LOCKDOWN: Prevent Squarespace edit mode conflicts
            this.setupAssetLibraryNuclearLockdown(drawer);

            // Add show class after a brief delay to trigger the slide animation
            requestAnimationFrame(() => {
                drawer.classList.add('show');
            });

            // Setup event listeners for search and filtering
            if (mediaAssets) {
                this.setupAssetFiltering(drawer, rowIndex, itemIndex);
            }

            // Setup NUCLEAR mousedown handlers for asset selection
            this.setupAssetSelectionMousedownHandlers(drawer, rowIndex, itemIndex);

            // Close drawer when clicking outside
            drawer.addEventListener('click', (e) => {
                if (e.target === drawer) {
                    this.closeAssetDrawer(drawer);
                }
            });

            // DISABLED: Close button now uses mousedown handler in setupAssetSelectionMousedownHandlers
            // const closeBtn = drawer.querySelector('.asset-drawer-close');
            // closeBtn.addEventListener('click', () => {
            //     this.closeAssetDrawer(drawer);
            // });
        }

        // ==================== NUCLEAR LOCKDOWN SYSTEM ====================
        // Based on People Cards NUCLEAR lockdown implementation
        
        setupAssetLibraryNuclearLockdown(drawer) {
            console.log('🛡️ Setting up NUCLEAR lockdown for asset library...');
            
            // NUCLEAR OPTION: Block ALL click and dblclick events in the asset drawer
            const blockEvents = ['click', 'dblclick'];
            
            blockEvents.forEach(eventType => {
                document.addEventListener(eventType, (event) => {
                    const target = event.target;
                    
                    // If it's anywhere in our asset drawer, block the event entirely
                    if (target && target.closest('.asset-drawer-overlay')) {
                        console.log(`🛡️ BLOCKING ${eventType} event in asset drawer:`, target);
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        return false;
                    }
                }, true);
            });
            
            console.log('✅ NUCLEAR lockdown for asset library complete');
        }

        setupAssetSelectionMousedownHandlers(drawer, rowIndex, itemIndex) {
            console.log('🖱️ Setting up mousedown handlers for asset drawer controls...');
            
            // Close button mousedown handler
            const closeBtn = drawer.querySelector('.asset-drawer-close');
            if (closeBtn) {
                closeBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Asset drawer close button mousedown');
                    this.closeAssetDrawer(drawer);
                });
            }
            
            // Upload button mousedown handler
            const uploadBtn = drawer.querySelector('.asset-drawer-upload');
            if (uploadBtn) {
                uploadBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Asset drawer upload button mousedown');
                    
                    // Don't close the drawer - keep it open for library uploads
                    // Trigger upload to library directly
                    this.uploadToAssetLibrary();
                });
            }
            
            // NOTE: Asset grid item selection is handled by the main document mousedown delegation
            // which already uses this.filteredAssets || this.currentMediaAssets for asset selection
            
            console.log('✅ Asset drawer mousedown handlers setup complete');
        }

        setupAssetFiltering(drawer, rowIndex, itemIndex) {
            const searchInput = drawer.querySelector('.asset-search');
            const filterSelect = drawer.querySelector('.asset-filter');
            const sortSelect = drawer.querySelector('.asset-sort');
            const assetGrid = drawer.querySelector('.asset-grid');
            const countSpan = drawer.querySelector('.asset-count');

            // Debounced search function
            let searchTimeout;
            const performSearch = () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterAndSortAssets(drawer, rowIndex, itemIndex);
                }, 300);
            };

            // Event listeners
            searchInput.addEventListener('input', performSearch);
            filterSelect.addEventListener('change', () => this.filterAndSortAssets(drawer, rowIndex, itemIndex));
            sortSelect.addEventListener('change', () => this.filterAndSortAssets(drawer, rowIndex, itemIndex));
            
            // Event delegation for clear search button (added dynamically)
            assetGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('clear-search-btn')) {
                    searchInput.value = '';
                    filterSelect.value = 'all';
                    this.filterAndSortAssets(drawer, rowIndex, itemIndex);
                }
            });
        }

        filterAndSortAssets(drawer, rowIndex, itemIndex) {
            const searchTerm = drawer.querySelector('.asset-search').value.toLowerCase();
            const filterType = drawer.querySelector('.asset-filter').value;
            const sortType = drawer.querySelector('.asset-sort').value;
            const assetGrid = drawer.querySelector('.asset-grid');
            const countSpan = drawer.querySelector('.asset-count');

            if (!this.currentMediaAssets) return;

            // Filter assets
            let filteredAssets = this.currentMediaAssets.filter(asset => {
                // Search filter
                const filename = (asset.stringMetaData?.fileName || asset.filename || '').toLowerCase();
                const title = (asset.title || asset.stringMetaData?.title || '').toLowerCase();
                const matchesSearch = !searchTerm || filename.includes(searchTerm) || title.includes(searchTerm);

                // Type filter (for media types)
                const assetType = asset.assetType === 'VIDEO' ? 'video' : 'image';
                let matchesType = true;
                
                if (filterType === 'image' || filterType === 'video') {
                    matchesType = filterType === assetType;
                } else if (filterType === 'used') {
                    // Show only assets used in the gallery
                    matchesType = this.isAssetUsedInGallery(asset);
                } else if (filterType === 'unused') {
                    // Show only assets NOT used in the gallery
                    matchesType = !this.isAssetUsedInGallery(asset);
                } else if (filterType === 'all') {
                    matchesType = true;
                }

                return matchesSearch && matchesType;
            });

            // Sort assets
            filteredAssets = this.sortAssets(filteredAssets, sortType);

            // Update the filtered assets reference
            this.filteredAssets = filteredAssets;

            // Update the grid
            assetGrid.innerHTML = filteredAssets.length > 0 
                ? this.createAssetGrid(filteredAssets, rowIndex, itemIndex)
                : this.createNoResultsMessage(searchTerm, filterType);

            // Update count
            countSpan.textContent = `${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''}`;
        }

        sortAssets(assets, sortType) {
            return [...assets].sort((a, b) => {
                switch (sortType) {
                    case 'name-asc':
                        const nameA = (a.stringMetaData?.fileName || a.filename || '').toLowerCase();
                        const nameB = (b.stringMetaData?.fileName || b.filename || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                    
                    case 'name-desc':
                        const nameA2 = (a.stringMetaData?.fileName || a.filename || '').toLowerCase();
                        const nameB2 = (b.stringMetaData?.fileName || b.filename || '').toLowerCase();
                        return nameB2.localeCompare(nameA2);
                    
                    case 'date-desc':
                        // Use createdAt field from Squarespace assets
                        const dateA = new Date(a.createdAt || a.createdOn || a.modifiedOn || a.uploadedOn || a.dateCreated || a.dateModified || 0);
                        const dateB = new Date(b.createdAt || b.createdOn || b.modifiedOn || b.uploadedOn || b.dateCreated || b.dateModified || 0);
                        return dateB - dateA; // Newest first (newer dates are larger numbers)
                    
                    case 'date-asc':
                        // Use createdAt field from Squarespace assets
                        const dateA2 = new Date(a.createdAt || a.createdOn || a.modifiedOn || a.uploadedOn || a.dateCreated || a.dateModified || 0);
                        const dateB2 = new Date(b.createdAt || b.createdOn || b.modifiedOn || b.uploadedOn || b.dateCreated || b.dateModified || 0);
                        return dateA2 - dateB2; // Oldest first (older dates are smaller numbers)
                    
                    default:
                        return 0;
                }
            });
        }

        isAssetUsedInGallery(asset) {
            // Check if an asset is currently used in any grid item
            if (!this.gridData || !asset.assetUrl) return false;
            
            for (const row of this.gridData) {
                if (row.items) {
                    for (const item of row.items) {
                        // Check if this item's content matches the asset URL
                        if (item.content && item.content === asset.assetUrl) {
                            return true;
                        }
                        // Also check if it matches alternative URL formats
                        if (item.content && this.normalizeAssetUrl(item.content) === this.normalizeAssetUrl(asset.assetUrl)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        normalizeAssetUrl(url) {
            // Remove query parameters and format specifications for comparison
            if (!url) return '';
            return url.split('?')[0];
        }

        createNoResultsMessage(searchTerm, filterType) {
            let filterText;
            switch (filterType) {
                case 'video':
                    filterText = 'videos';
                    break;
                case 'image':
                    filterText = 'images';
                    break;
                case 'used':
                    filterText = 'used assets';
                    break;
                case 'unused':
                    filterText = 'unused assets';
                    break;
                default:
                    filterText = 'assets';
            }
            
            const message = searchTerm 
                ? `No ${filterText} found matching "${searchTerm}"`
                : `No ${filterText} found`;
                
            return `
                <div class="no-results-message">
                    <div class="no-results-icon">🔍</div>
                    <h4>No Results Found</h4>
                    <p>${message}</p>
                    <button class="clear-search-btn">Clear Search</button>
                </div>
            `;
        }

        createSkeletonLoaders() {
            // Create 12 skeleton items to simulate loading
            return Array.from({ length: 12 }, (_, index) => {
                // Make some random skeletons wider (simulating videos)
                const isWideItem = Math.random() > 0.7; // 30% chance of being wide
                const wideClass = isWideItem ? 'skeleton-wide' : '';
                
                return `
                    <div class="asset-grid-item skeleton-loader ${wideClass}">
                        <div class="skeleton-thumbnail"></div>
                        <div class="asset-info">
                            <div class="skeleton-title"></div>
                            <div class="skeleton-filename"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        updateAssetDrawerContent(mediaAssets, rowIndex, itemIndex) {
            this.currentMediaAssets = mediaAssets;
            this.filteredAssets = mediaAssets;
            
            const drawer = document.querySelector('.asset-drawer-overlay');
            if (!drawer) return;
            
            const assetGrid = drawer.querySelector('.asset-grid');
            const countSpan = drawer.querySelector('.asset-count');
            
            if (assetGrid) {
                assetGrid.innerHTML = this.createAssetGrid(mediaAssets, rowIndex, itemIndex);
            }
            
            if (countSpan) {
                countSpan.textContent = `${mediaAssets.length} asset${mediaAssets.length !== 1 ? 's' : ''}`;
            }
            
            // Set up filtering now that assets are loaded
            this.setupAssetFiltering(drawer, rowIndex, itemIndex);
        }

        showAssetDrawerError(errorMessage) {
            const assetGrid = document.querySelector('.asset-drawer .asset-grid');
            if (assetGrid) {
                assetGrid.innerHTML = `
                    <div class="asset-error-state">
                        <div class="error-icon">⚠️</div>
                        <h4>Error Loading Assets</h4>
                        <p>${errorMessage}</p>
                        <button class="retry-button" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }

        closeAssetDrawer(drawer) {
            drawer.classList.remove('show');
            // Wait for animation to complete before removing
            setTimeout(() => {
                drawer.remove();
            }, 300);
        }

        createAssetGrid(mediaAssets, rowIndex, itemIndex) {
            return mediaAssets.map((asset, index) => {
                const isVideo = asset.assetType === 'VIDEO';
                const filename = asset.stringMetaData?.fileName || asset.filename || 'Untitled';
                const title = asset.title || asset.stringMetaData?.title || filename;
                const thumbnailId = isVideo ? `asset-video-${index}-${Math.random().toString(36).substr(2, 9)}` : '';
                
                let thumbnailUrl;
                if (isVideo) {
                    // For videos, start with a placeholder and load thumbnail asynchronously
                    thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNCI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+';
                    
                    // Load actual thumbnail asynchronously (same technique as admin drawer)
                    setTimeout(async () => {
                        const thumbnailUrl = await this.getVideoThumbnail(asset);
                        const imgElement = document.getElementById(thumbnailId);
                        if (imgElement && thumbnailUrl) {
                            imgElement.src = thumbnailUrl;
                            console.log(`🎬 Asset library thumbnail loaded: ${thumbnailUrl} for ${filename}`);
                        }
                    }, 10); // Small delay to ensure DOM is ready
                    
                } else {
                    // Handle image thumbnails
                    thumbnailUrl = asset.assetUrl;
                    if (thumbnailUrl.includes('?format=original')) {
                        thumbnailUrl = thumbnailUrl.replace('?format=original', '?format=300w');
                    } else if (thumbnailUrl.includes('?')) {
                        thumbnailUrl = thumbnailUrl + '&format=300w';
                    } else {
                        thumbnailUrl = thumbnailUrl + '?format=300w';
                    }
                }
                
                const videoOverlay = isVideo ? `<div class="video-play-overlay">
                    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 14.3336V3.66698C1 2.78742 1 2.34715 1.18509 2.08691C1.34664 1.85977 1.59564 1.71064 1.87207 1.67499C2.18868 1.63415 2.57701 1.84126 3.35254 2.25487L13.3525 7.58821L13.3562 7.58982C14.2132 8.04692 14.642 8.27557 14.7826 8.58033C14.9053 8.84619 14.9053 9.15308 14.7826 9.41894C14.6418 9.72413 14.212 9.95371 13.3525 10.4121L3.35254 15.7454C2.57645 16.1593 2.1888 16.3657 1.87207 16.3248C1.59564 16.2891 1.34664 16.1401 1.18509 15.9129C1 15.6527 1 15.2132 1 14.3336Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>` : '';
                const assetTypeClass = isVideo ? 'video-asset' : 'image-asset';
                
                return `
                    <div class="asset-grid-item ${assetTypeClass}" data-asset-index="${index}" data-row-index="${rowIndex}" data-item-index="${itemIndex}">
                        <div class="asset-thumbnail">
                            <img ${thumbnailId ? `id="${thumbnailId}"` : ''} src="${thumbnailUrl}" alt="${filename}" loading="lazy">
                            ${videoOverlay}
                        </div>
                        <div class="asset-info">
                            <span class="asset-filename">${filename}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }



        async selectAsset(assetData, rowIndex, itemIndex) {
            // Close the drawer
            const drawer = document.querySelector('.asset-drawer-overlay');
            if (drawer) {
                this.closeAssetDrawer(drawer);
            }

            // Determine asset type and URL
            const isVideo = assetData.assetType === 'VIDEO';
            const assetType = isVideo ? 'video' : 'image';
            let assetUrl = assetData.assetUrl;
            
            // Get filename early since we need it for video processing
            const filename = assetData.stringMetaData?.fileName || assetData.filename || 'Untitled';
            
            // For videos, check if it's private and authorize it if needed
            if (isVideo) {
                console.log(`🎬 Processing video for storage:`, assetUrl);
                
                // Always add to our lesson collection to ensure permanent access
                console.log(`🎬 📚 Adding video to lesson collection for permanent access...`);
                try {
                    const crumbToken = this.getCrumbToken();
                    if (crumbToken) {
                        await this.performFauxSectionSave(assetData.id, crumbToken, filename);
                    } else {
                        console.log(`🎬 ⚠️  No CSRF token found, skipping lesson collection addition`);
                    }
                } catch (error) {
                    console.error(`🎬 ❌ Failed to add video to lesson collection:`, error);
                    // Continue anyway - video might still work
                }
                
                // Also check if the video is private and needs authorization
                if (assetData.protectionLevel === 'PRIVATE') {
                    console.log(`🎬 🔐 Private video detected, authorizing for public access...`);
                    try {
                        const authResult = await this.authorizePrivateVideo(assetData);
                        
                        // If we got an accessible video URL, use that instead
                        if (authResult && authResult.accessibleVideoUrl) {
                            assetUrl = authResult.accessibleVideoUrl;
                            console.log(`🎬 🔓 Using accessible video URL: ${assetUrl}`);
                        }
                        
                        console.log(`🎬 ✅ Video authorized successfully`);
                    } catch (error) {
                        console.error(`🎬 ❌ Failed to authorize video:`, error);
                        // Continue anyway - the video might still work or fail gracefully
                    }
                }
            }
            
            console.log(`Storing ${assetType} URL:`, assetUrl);

            console.log(`Full ${assetType} data:`, assetData);
            console.log(`${assetType.charAt(0).toUpperCase() + assetType.slice(1)} URL:`, assetUrl);

            // Update the item with correct type and URL
            this.updateItemType(rowIndex, itemIndex, assetType);
            this.updateItemContent(rowIndex, itemIndex, assetUrl);
            
            // For videos, also store metadata for thumbnail retrieval
            if (isVideo) {
                this.updateItemMetadata(rowIndex, itemIndex, {
                    assetData: assetData,
                    defaultThumbnail: assetData.defaultThumbnail,
                    thumbnails: assetData.thumbnails
                });
            }

            console.log(`Selected ${assetType}: ${filename} for row ${rowIndex}, item ${itemIndex}`);
        }

        updateSpecificRowInAdmin(rowIndex) {
            // Find the specific accordion item for this row
            const accordionItem = document.querySelector(`[data-row-index="${rowIndex}"]`);
            if (!accordionItem) return;

            // Check if this accordion is expanded
            const isExpanded = accordionItem.classList.contains('expanded');
            
            if (isExpanded) {
                // Update just the content of this accordion
                const accordionContent = accordionItem.querySelector('.accordion-content');
                if (accordionContent && this.gridData[rowIndex]) {
                    const row = this.gridData[rowIndex];
                    const newForm = this.createRowForm(row, rowIndex);
                    accordionContent.innerHTML = '';
                    accordionContent.appendChild(newForm);
                }
            }
        }

        toggleAccordion(accordionItem) {
            const content = accordionItem.querySelector('.accordion-content');
            const isExpanded = accordionItem.classList.contains('expanded');

            if (isExpanded) {
                accordionItem.classList.remove('expanded');
                content.classList.remove('active');
            } else {
                // Close other accordions
                document.querySelectorAll('.accordion-item').forEach(item => {
                    item.classList.remove('expanded');
                    item.querySelector('.accordion-content').classList.remove('active');
                });

                accordionItem.classList.add('expanded');
                content.classList.add('active');
            }
        }

        removeRow(index) {
            if (confirm('Are you sure you want to remove this row?')) {
                this.gridData.splice(index, 1);
                this.renderGrid();
                this.renderAdminForm();
                this.markAsChanged();
            }
        }

        updateRowLayout(rowIndex, newLayout) {
            if (this.gridData[rowIndex]) {
                // Store all current images in temporary storage before changing layout
                this.storeRowImagesTemporarily(rowIndex);
                
                this.gridData[rowIndex].layout = newLayout;
                
                // Update items array to match new layout
                const layoutData = {
                    '100': { items: 1 },
                    '50-50': { items: 2 },
                    '50p-50l': { items: 2 },
                    '25s-75l': { items: 3 },
                    '67l-33l': { items: 2 },
                    '33l-67l': { items: 2 },
                    '67-left': { items: 2 },
                    '67-right': { items: 2 },
                    '33-33-33': { items: 3 },
                    '50-25-25': { items: 3 },
                    '25-25-50': { items: 3 },
                    '25-50-25': { items: 3 },
                    '25-25-25-25': { items: 4 },
                    // Advanced Layouts
                    '70-15-15': { items: 3 },
                    '60-20-20': { items: 3 },
                    'irregular-6': { items: 5 },
                    'two-row-6': { items: 6 }
                };
                
                const layout = layoutData[newLayout];
                if (layout) {
                    const newItems = [];
                    
                    for (let i = 0; i < layout.items; i++) {
                        // Check if this position should be an empty space for the new layouts
                        const isEmptySpace = (newLayout === '67-left' && i === 1) || (newLayout === '67-right' && i === 0);
                        
                        if (isEmptySpace) {
                            // Always create empty space items for these positions
                            newItems[i] = {
                                type: 'empty',
                                content: ''
                            };
                        } else {
                            // Try to restore from temporary storage first, then current items, then placeholder
                            const restoredImage = this.getStoredImageForPosition(rowIndex, i);
                            if (restoredImage) {
                                newItems[i] = restoredImage;
                            } else {
                                const currentItem = this.gridData[rowIndex].items && this.gridData[rowIndex].items[i];
                                newItems[i] = currentItem || { 
                                    type: 'placeholder', 
                                    background: `hsl(${i * 60}, 70%, 60%)`, 
                                    content: `Item ${i + 1}` 
                                };
                            }
                        }
                    }
                    
                    this.gridData[rowIndex].items = newItems;
                }

                // Only update the specific layout areas instead of full re-render
                this.updateRowLayoutAreas(rowIndex);
                this.markAsChanged();
            }
        }

        updateRowLayoutAreas(rowIndex) {
            // Update the visual layout areas for this specific row without full re-render
            const accordionItem = document.querySelector(`.accordion-item[data-row-index="${rowIndex}"]`);
            if (!accordionItem) return;
            
            const layoutDisplay = accordionItem.querySelector('.layout-display');
            if (layoutDisplay) {
                const row = this.gridData[rowIndex];
                layoutDisplay.innerHTML = this.createVisualLayoutAreas(row, rowIndex);
                
                // Re-add drag functionality to the new layout areas
                this.addItemDragListeners(layoutDisplay, rowIndex);
            }
            
            // Also update the grid display (front-end view)
            this.renderGrid();
        }

        storeRowImagesTemporarily(rowIndex) {
            // Store all non-placeholder images from this row in temporary storage
            if (!this.tempRowImages[rowIndex]) {
                this.tempRowImages[rowIndex] = {};
            }
            
            const currentItems = this.gridData[rowIndex].items || [];
            currentItems.forEach((item, itemIndex) => {
                if (item && item.type !== 'placeholder') {
                    this.tempRowImages[rowIndex][itemIndex] = JSON.parse(JSON.stringify(item));
                }
            });
            
            console.log(`📦 Stored ${Object.keys(this.tempRowImages[rowIndex]).length} images temporarily for row ${rowIndex}`);
        }

        getStoredImageForPosition(rowIndex, itemIndex) {
            // Try to retrieve a stored image for this position
            if (this.tempRowImages[rowIndex] && this.tempRowImages[rowIndex][itemIndex]) {
                const storedImage = this.tempRowImages[rowIndex][itemIndex];
                console.log(`📦 Restored image from temporary storage for row ${rowIndex}, item ${itemIndex}`);
                return storedImage;
            }
            return null;
        }

        clearTempRowImages(rowIndex = null) {
            // Clear temporary storage for a specific row or all rows
            if (rowIndex !== null) {
                delete this.tempRowImages[rowIndex];
                console.log(`📦 Cleared temporary storage for row ${rowIndex}`);
            } else {
                this.tempRowImages = {};
                console.log(`📦 Cleared all temporary storage`);
            }
        }

        updateItemType(rowIndex, itemIndex, newType) {
            if (this.gridData[rowIndex] && this.gridData[rowIndex].items[itemIndex]) {
                this.gridData[rowIndex].items[itemIndex].type = newType;
                this.renderGrid();
                this.updateSpecificRowInAdmin(rowIndex); // Update just this row in admin
                this.markAsChanged();
            }
        }

        updateItemContent(rowIndex, itemIndex, newContent) {
            if (this.gridData[rowIndex] && this.gridData[rowIndex].items[itemIndex]) {
                this.gridData[rowIndex].items[itemIndex].content = newContent;
                this.renderGrid();
                this.updateSpecificRowInAdmin(rowIndex); // Update just this row in admin
                this.markAsChanged();
            }
        }

        updateItemMetadata(rowIndex, itemIndex, metadata) {
            if (this.gridData[rowIndex] && this.gridData[rowIndex].items[itemIndex]) {
                this.gridData[rowIndex].items[itemIndex].metadata = metadata;
                this.renderGrid();
                this.updateSpecificRowInAdmin(rowIndex); // Update just this row in admin
                this.markAsChanged();
            }
        }

        updateItemBackground(rowIndex, itemIndex, newBackground) {
            if (this.gridData[rowIndex] && this.gridData[rowIndex].items[itemIndex]) {
                this.gridData[rowIndex].items[itemIndex].background = newBackground;
                this.renderGrid();
                this.markAsChanged();
            }
        }

        renderGrid() {
            if (!this.masonryGrid) return;

            this.masonryGrid.innerHTML = '';

            this.gridData.forEach((row, rowIndex) => {
                // Skip draft rows in the front-end gallery display
                if (row.isDraft) return;
                
                const rowElement = document.createElement('div');
                rowElement.className = `masonry-row layout-${row.layout}`;
                
                // Add full-width class if enabled
                if (row.fullWidth) {
                    rowElement.classList.add('full-width');
                }
                
                // Add height class
                const height = row.height || 'medium';
                rowElement.classList.add(`height-${height}`);

                if (row.layout === '50-25-25') {
                    // Special handling for Left + Stack layout
                    // First item (left side)
                    if (row.items[0]) {
                        const leftItem = this.createMasonryItem(row.items[0], 0, rowIndex, row.layout);
                        rowElement.appendChild(leftItem);
                    }

                    // Right stack container
                    const rightStack = document.createElement('div');
                    rightStack.className = 'masonry-right-stack';
                    
                    // Second and third items (right stack)
                    if (row.items[1]) {
                        const topItem = this.createMasonryItem(row.items[1], 1, rowIndex, row.layout);
                        rightStack.appendChild(topItem);
                    }
                    if (row.items[2]) {
                        const bottomItem = this.createMasonryItem(row.items[2], 2, rowIndex, row.layout);
                        rightStack.appendChild(bottomItem);
                    }
                    
                    rowElement.appendChild(rightStack);
                } else if (row.layout === '25-25-50') {
                    // Special handling for Right + Stack layout
                    // Left stack container
                    const leftStack = document.createElement('div');
                    leftStack.className = 'masonry-left-stack';
                    
                    // First and second items (left stack)
                    if (row.items[0]) {
                        const topItem = this.createMasonryItem(row.items[0], 0, rowIndex, row.layout);
                        leftStack.appendChild(topItem);
                    }
                    if (row.items[1]) {
                        const bottomItem = this.createMasonryItem(row.items[1], 1, rowIndex, row.layout);
                        leftStack.appendChild(bottomItem);
                    }
                    
                    rowElement.appendChild(leftStack);
                    
                    // Third item (right side)
                    if (row.items[2]) {
                        const rightItem = this.createMasonryItem(row.items[2], 2, rowIndex, row.layout);
                        rowElement.appendChild(rightItem);
                    }
                } else if (row.layout === '70-15-15') {
                    // Special handling for Hero + Grid layout
                    // First item (left side - 70%)
                    if (row.items[0]) {
                        const leftItem = this.createMasonryItem(row.items[0], 0, rowIndex, row.layout);
                        rowElement.appendChild(leftItem);
                    }

                    // Right stack container for small images (30%)
                    const rightStack = document.createElement('div');
                    rightStack.className = 'masonry-right-stack';
                    
                    // Second and third items (right stack)
                    if (row.items[1]) {
                        const topItem = this.createMasonryItem(row.items[1], 1, rowIndex, row.layout);
                        rightStack.appendChild(topItem);
                    }
                    if (row.items[2]) {
                        const bottomItem = this.createMasonryItem(row.items[2], 2, rowIndex, row.layout);
                        rightStack.appendChild(bottomItem);
                    }
                    
                    rowElement.appendChild(rightStack);
                } else if (row.layout === 'irregular-6') {
                    // Special handling for Pinterest-style irregular layout
                    // First item (left side - takes 50% space)
                    if (row.items[0]) {
                        const leftItem = this.createMasonryItem(row.items[0], 0, rowIndex, row.layout);
                        rowElement.appendChild(leftItem);
                    }

                    // Right grid container for 2x2 layout (takes other 50% space)
                    const rightGrid = document.createElement('div');
                    rightGrid.className = 'masonry-right-grid';
                    
                    // Items 2-5 in the 2x2 grid
                    for (let i = 1; i < 5; i++) {
                        if (row.items[i]) {
                            const gridItem = this.createMasonryItem(row.items[i], i, rowIndex, row.layout);
                            rightGrid.appendChild(gridItem);
                        }
                    }
                    
                    rowElement.appendChild(rightGrid);
                } else if (row.layout === '25s-75l') {
                    // Special handling for Stack + Landscape layout
                    // Left stack container (25%)
                    const leftStack = document.createElement('div');
                    leftStack.className = 'masonry-left-stack';
                    
                    // First and second items (left stack - portrait)
                    if (row.items[0]) {
                        const topItem = this.createMasonryItem(row.items[0], 0, rowIndex, row.layout);
                        leftStack.appendChild(topItem);
                    }
                    if (row.items[1]) {
                        const bottomItem = this.createMasonryItem(row.items[1], 1, rowIndex, row.layout);
                        leftStack.appendChild(bottomItem);
                    }
                    
                    rowElement.appendChild(leftStack);
                    
                    // Third item (right side - landscape, 75%)
                    if (row.items[2]) {
                        const rightItem = this.createMasonryItem(row.items[2], 2, rowIndex, row.layout);
                        rowElement.appendChild(rightItem);
                    }
                } else {
                    // Standard layout handling
                    row.items.forEach((item, itemIndex) => {
                        const itemElement = this.createMasonryItem(item, itemIndex, rowIndex, row.layout);
                        rowElement.appendChild(itemElement);
                    });
                }

                this.masonryGrid.appendChild(rowElement);
            });
        }

        createMasonryItem(item, itemIndex, rowIndex, layout = null) {
            const itemElement = document.createElement('div');
            itemElement.className = 'masonry-item';
            
            if (item.type === 'empty') {
                // Empty space item - no background, no content, no interaction
                itemElement.classList.add('empty-space');
                itemElement.style.background = 'transparent';
                itemElement.style.pointerEvents = 'none';
                return itemElement;
            } else if (item.type === 'placeholder') {
                itemElement.classList.add('placeholder');
                itemElement.style.backgroundColor = item.background || '#667eea';
                itemElement.textContent = item.content || `Item ${itemIndex + 1}`;
            } else if (item.type === 'image' && item.content) {
                // Use img tag for all screen sizes for better responsiveness
                const img = document.createElement('img');
                img.src = item.content;
                img.className = 'masonry-item-image';
                img.style.width = '100%';
                img.style.display = 'block';
                img.style.borderRadius = 'inherit';
                
                // Desktop: fixed height for consistent masonry layout
                // Special layouts (50p-50l and 25s-75l) will be handled by CSS with aspect-ratio
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                itemElement.appendChild(img);
            } else if (item.type === 'video' && item.content) {
                const video = document.createElement('video');
                video.controls = false;  // Remove controls for clean background videos
                video.muted = true;
                video.autoplay = true;   // Auto-play the videos
                video.loop = true;       // Loop for continuous playback
                video.playsInline = true;
                
                // Check if container has no-crop class
                const container = document.querySelector('.masonry-container');
                const isNoCrop = container && container.classList.contains('no-crop');
                
                // Only set inline styles if NOT in no-crop mode
                if (!isNoCrop) {
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'cover';
                }
                video.style.pointerEvents = 'none'; // Always prevent interaction for pure background effect
                
                // Check if it needs HLS handling (Squarespace videos or m3u8 files)
                const playlistUrl = this.getVideoPlaylistUrl(item.content);
                const needsHLS = playlistUrl !== item.content || item.content.includes('.m3u8');
                
                if (needsHLS) {
                    // Squarespace video - use HLS for both admin and frontend
                    // Frontend can access playlist.m3u8 without authentication
                    if (typeof Hls === 'undefined') {
                        const hlsScript = document.createElement('script');
                        hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
                        hlsScript.onload = () => {
                            this.setupHLSVideo(video, item.content);
                        };
                        document.head.appendChild(hlsScript);
                    } else {
                        this.setupHLSVideo(video, item.content);
                    }
                } else {
                    // Regular MP4 or other video format
                    video.src = item.content;
                }
                
                itemElement.appendChild(video);

                // Add play icon overlay for frontend videos (not in admin mode)
                if (!this.isAdminMode) {
                    const playIcon = document.createElement('div');
                    playIcon.className = 'video-play-icon';
                    playIcon.innerHTML = `
                        <svg width="48" height="48" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_video_play)">
                                <path d="M1.8999 18.9999C1.8999 28.444 9.55584 36.0999 18.9999 36.0999C28.444 36.0999 36.0999 28.444 36.0999 18.9999C36.0999 9.55584 28.444 1.8999 18.9999 1.8999C9.55584 1.8999 1.8999 9.55584 1.8999 18.9999Z" stroke="white" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.2 24.7V13.3L24.7 19L15.2 24.7Z" fill="white" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_video_play">
                                    <rect width="38" height="38" fill="white"/>
                                </clipPath>
                            </defs>
                        </svg>
                    `;
                    itemElement.appendChild(playIcon);
                }
            }

            // Add click handler for lightbox (for images and videos with content)
            if (item.type !== 'placeholder' && (item.type === 'image' || item.type === 'video') && item.content && typeof rowIndex !== 'undefined') {
                itemElement.style.cursor = 'pointer';
                itemElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openLightbox(rowIndex, itemIndex);
                });
            }

            return itemElement;
        }

        async loadExternalConfig() {
            try {
                // Check for external widget configuration source
                const metaTags = document.head.querySelectorAll('meta');
                let configUrl = null;

                // Look for plugin license key configuration in page meta
                for (const tag of metaTags) {
                    if (tag.getAttribute('squarehero-plugin') === 'masonry-grid') {
                        // Decode the license key to get configuration URL
                        const encodedUrl = tag.getAttribute('license-key');
                        configUrl = atob(encodedUrl);
                        break;
                    }
                }

                if (!configUrl) {
                    console.log('📝 No external configuration found, using empty grid');
                    return null;
                }

                console.log('🔗 Loading configuration from:', configUrl);
                const response = await fetch(configUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch configuration: ${response.status}`);
                }

                const data = await response.json();
                console.log('✅ External configuration loaded successfully');
                return data;
                
            } catch (error) {
                console.error('❌ Error loading external configuration:', error);
                return null;
            }
        }

        async loadWidgetData() {
            try {
                console.log('📥 Starting data load process...');
                console.log('🆔 Current section ID:', this.sectionId);
                
                // Try to load from external config first
                const externalData = await this.loadExternalConfig();
                
                if (externalData && externalData[this.sectionId]) {
                    console.log('📊 Using external configuration data');
                    const sectionConfig = externalData[this.sectionId];
                    
                    // Extract the rows array from the section config
                    this.gridData = sectionConfig.rows || [];
                    
                    // Store other config properties for later use
                    this.currentLayout = sectionConfig.layout || 'layout-5050';
                    this.accordionEnabled = sectionConfig.accordion || false;
                    
                    // Load style settings
                    this.styleSettings = sectionConfig.styleSettings || {
                        rowGap: 50,
                        itemGap: 50,
                        mobileRowGap: 30,
                        mobileItemGap: 20,
                        borderRadius: 8,
                        shadow: 'none',
                        hoverEffect: 'scale'
                    };

                    // Ensure mobile gap settings exist (for backward compatibility)
                    if (this.styleSettings.mobileRowGap === undefined) {
                        this.styleSettings.mobileRowGap = 30;
                    }
                    if (this.styleSettings.mobileItemGap === undefined) {
                        this.styleSettings.mobileItemGap = 20;
                    }
                    
                    console.log('🔧 Loaded gridData:', this.gridData);
                    console.log('🎨 Layout:', this.currentLayout);
                } else {
                    console.log('📝 No data found for section, using default');
                    this.gridData = [
                        {
                            layout: '50-50',
                            items: [
                                { type: 'placeholder', background: '#667eea', content: 'Sample Item 1' },
                                { type: 'placeholder', background: '#f093fb', content: 'Sample Item 2' }
                            ]
                        }
                    ];
                    this.currentLayout = 'layout-5050';
                    this.accordionEnabled = false;
                    
                    // Initialize default style settings
                    this.styleSettings = {
                        rowGap: 50,
                        itemGap: 50,
                        borderRadius: 8,
                        shadow: 'none',
                        hoverEffect: 'scale'
                    };
                }

                this.renderGrid();
                this.updateStyles(); // Apply loaded style settings
                console.log('✅ Widget data loaded and rendered successfully');
                
            } catch (error) {
                console.error('❌ Error loading widget data:', error);
                this.showError('Failed to load grid data. Please refresh the page.');
            }
        }

        showError(message) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">⚠️ Error</h3>
                    <p style="color: #666; margin-bottom: 20px;">${message}</p>
                    <button id="retry-btn" class="btn btn-primary">Retry</button>
                </div>
            `;

            const retryBtn = document.getElementById('retry-btn');
            retryBtn.addEventListener('click', () => this.loadWidgetData());
        }

        markAsChanged() {
            this.hasUnsavedChanges = true;
            this.showAdminFooter('You have unsaved changes', 'changes');
        }

        showAdminFooter(message, type = 'info', persistent = false) {
            this.adminStatus.textContent = message;
            this.adminStatus.className = `admin-status ${type}`;
            this.adminStatus.style.display = 'block';
            this.adminSaveBtn.style.display = 'inline-block';
            this.adminDiscardBtn.style.display = 'inline-block';
            this.adminFooter.classList.add('show'); // Show the entire footer

            // Only auto-hide success messages, not changes or errors
            if (!persistent && type === 'success') {
                setTimeout(() => {
                    this.hideAdminFooter();
                }, 3000);
            }
        }

        hideAdminFooter() {
            this.adminStatus.style.display = 'none';
            this.adminSaveBtn.style.display = 'none';
            this.adminDiscardBtn.style.display = 'none';
            this.adminFooter.classList.remove('show'); // Hide the entire footer
        }

        discardChanges() {
            this.gridData = JSON.parse(JSON.stringify(this.originalData));
            this.clearTempRowImages(); // Clear temporary image storage when discarding
            this.renderGrid();
            this.renderAdminForm();
            this.hasUnsavedChanges = false;
            this.hideAdminFooter(); // Hide footer when changes are discarded
        }

        handleAdminClose() {
            if (this.hasUnsavedChanges) {
                this.showAdminFooter('You have unsaved changes! Please save or discard them before closing.', 'changes', true);
                return;
            }
            this.toggleAdminMode();
        }

        handleBackdropClick() {
            if (this.hasUnsavedChanges) {
                // Don't close the drawer, shake the footer instead
                this.shakeFooter();
                // Also show/update the footer message
                this.showAdminFooter('You have unsaved changes! Please save or discard them before closing.', 'changes', true);
            } else {
                // No unsaved changes, safe to close
                this.toggleAdminMode();
            }
        }

        shakeFooter() {
            if (this.adminFooter) {
                // Remove any existing shake class
                this.adminFooter.classList.remove('shake');
                // Force reflow to ensure the class removal takes effect
                this.adminFooter.offsetHeight;
                // Add the shake class
                this.adminFooter.classList.add('shake');
                
                // Remove the shake class after animation completes
                setTimeout(() => {
                    this.adminFooter.classList.remove('shake');
                }, 600); // Match the animation duration
            }
        }

        async saveConfiguration() {
            try {
                this.showAdminFooter('Saving configuration...', 'loading', false);

                // Serialize current grid configuration
                const configData = this.serializeGridConfiguration();
                console.log('📄 Configuration to save:', configData);
                
                // Get existing config to merge with current section
                let fullConfig = {};
                try {
                    const existingMeta = document.querySelector('meta[squarehero-plugin="masonry-grid"]');
                    if (existingMeta) {
                        const existingUrl = atob(existingMeta.getAttribute('license-key'));
                        console.log('🔍 Found existing config URL:', existingUrl);
                        
                        const response = await fetch(existingUrl);
                        if (response.ok) {
                            const existingConfig = await response.json();
                            fullConfig = existingConfig;
                        } else {
                            console.log('📝 No existing config found, creating new');
                            fullConfig = {};
                        }
                    } else {
                        fullConfig = {};
                    }
                } catch (error) {
                    console.log('📝 Could not load existing config, starting fresh:', error.message);
                    fullConfig = {};
                }
                
                console.log('🔧 Full config before update:', fullConfig);
                
                // Store config by section ID to support multiple sections
                if (this.sectionId) {
                    fullConfig[this.sectionId] = configData;
                    console.log('📊 Section data saved:', fullConfig[this.sectionId]);
                } else {
                    // Fallback: save directly if no section ID
                    fullConfig = configData;
                }
                
                console.log('🎯 Final config to save:', fullConfig);
                
                // Create JSON blob and upload to CSS assets
                const configContent = JSON.stringify(fullConfig, null, 2);
                const blob = new Blob([configContent], { type: 'application/json' });
                
                // Get CSRF token using the CDN edge token method
                const edgeToken = this.getCdnEdgeToken();
                if (!edgeToken) {
                    throw new Error('CDN edge token required - please refresh and try again');
                }
                
                // Cleanup existing cached configuration
                await this.removeExistingMasonryConfig(edgeToken);
                
                // Upload to CSS assets
                const formData = new FormData();
                // Base64 encode filename for CDN optimization routing
                const encodedFilename = btoa('masonry-manifest.json') + '.json';
                formData.append('file', blob, encodedFilename);
                
                const uploadResponse = await fetch(`${window.location.origin}/api/uploads/css-assets`, {
                    method: 'POST',
                    headers: {
                        'x-csrf-token': edgeToken
                    },
                    body: formData,
                    credentials: 'include'
                });
                
                if (!uploadResponse.ok) {
                    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
                }
                
                const uploadResult = await uploadResponse.json();
                console.log('📤 Upload result:', uploadResult);
                
                // Extract reference from the response
                let configUrl = null;
                if (uploadResult.media && uploadResult.media.length > 0) {
                    const mediaItem = uploadResult.media[0];
                    configUrl = mediaItem.staticUrl || mediaItem.url || mediaItem.assetUrl;
                } else {
                    configUrl = uploadResult.staticUrl || uploadResult.url || uploadResult.assetUrl;
                }
                
                if (!configUrl) {
                    throw new Error('No URL returned from upload');
                }
                
                console.log('🔗 Config uploaded to:', configUrl);

                const success = await this.updateConfigReference(configUrl);

                if (success) {
                    this.originalData = JSON.parse(JSON.stringify(this.gridData));
                    this.hasUnsavedChanges = false;
                    this.clearTempRowImages(); // Clear temporary image storage after saving
                    this.showAdminFooter('Configuration saved successfully!', 'success', false);
                    
                    setTimeout(() => {
                        this.hideAdminFooter();
                    }, 2000);
                } else {
                    this.showAdminFooter('Failed to save configuration. Please try again.', 'error', true);
                }

            } catch (error) {
                console.error('Save error:', error);
                this.showAdminFooter('Error saving configuration: ' + error.message, 'error', true);
            }
        }

        serializeGridConfiguration() {
            // Get current layout settings from the admin form
            const layoutSelect = this.adminForm ? this.adminForm.querySelector('select[name="layout"]') : null;
            const layoutOption = layoutSelect ? layoutSelect.value : 'layout-5050';
            
            // Get accordion settings - not implemented in current interface, default to false
            const accordionEnabled = false;
            
            // Serialize current grid data
            const items = [];
            if (this.gridData && Array.isArray(this.gridData)) {
                this.gridData.forEach((row, rowIndex) => {
                    if (row.items && Array.isArray(row.items)) {
                        row.items.forEach((item, itemIndex) => {
                            items.push({
                                id: item.id || `row-${rowIndex}-item-${itemIndex}`,
                                content: item.content || '',
                                imageUrl: item.imageUrl || '',
                                title: item.title || '',
                                description: item.description || '',
                                type: item.type || 'image',
                                rowIndex: rowIndex,
                                itemIndex: itemIndex
                            });
                        });
                    }
                });
            }
            
            // If no grid data yet, create a basic structure
            if (items.length === 0) {
                items.push({
                    id: 'default-item-1',
                    content: 'Sample content',
                    imageUrl: 'https://via.placeholder.com/400x300',
                    title: 'Sample Item',
                    description: 'This is a sample masonry grid item',
                    type: 'image',
                    rowIndex: 0,
                    itemIndex: 0
                });
            }
            
            return {
                layout: layoutOption,
                accordion: accordionEnabled,
                rows: this.gridData || [],
                items: items,
                styleSettings: this.styleSettings || {
                    rowGap: 50,
                    itemGap: 50,
                    mobileRowGap: 30,
                    mobileItemGap: 20,
                    borderRadius: 8,
                    shadow: 'none',
                    hoverEffect: 'scale'
                },
                version: '1.0.0',
                lastModified: new Date().toISOString()
            };
        }

        async removeExistingMasonryConfig(edgeToken) {
            try {
                // Get site identifier for CDN cache invalidation
                const siteData = await this.apiRequest("/api/v1/commerce-preferences/onboarding", edgeToken);
                if (!siteData?.websiteId) {
                    return false;
                }
                const siteId = siteData.websiteId;

                // Get asset list
                const tplId = "5c5a519771c10ba3470d8101";
                const assetsUrl = `https://${window.location.host}/api/template/GetTemplateCSSAssets?templateId=${tplId}&websiteId=${siteId}&recordType=16`;

                const assetList = await this.apiRequest(assetsUrl, edgeToken);
                if (!assetList?.assets) {
                    return false;
                }

                // Find existing masonry configuration files for cache purging
                const encodedFilename = btoa('masonry-manifest.json') + '.json';
                const existingConfigs = assetList.assets.filter(asset => asset.filename === encodedFilename);

                if (existingConfigs.length === 0) {
                    return false;
                }

                // Remove files from CDN edge cache
                const removeEndpoint = `https://${window.location.host}/api/template/RemoveTemplateCSSAsset`;
                let removedCount = 0;

                for (const config of existingConfigs) {
                    try {
                        const removeBody = {
                            templateId: tplId,
                            websiteId: siteId,
                            itemId: config.id
                        };

                        const removeResponse = await this.apiRequest(removeEndpoint, edgeToken, 'POST', removeBody, true);

                        if (removeResponse !== null) {
                            removedCount++;
                            console.log(`🗑️ Removed old config: ${config.filename}`);
                        }
                    } catch (removeError) {
                        console.warn(`⚠️ Failed to remove config ${config.filename}:`, removeError.message);
                    }
                }

                console.log(`🧹 Cache cleanup complete: ${removedCount} files removed`);
                return removedCount > 0;

            } catch (error) {
                console.warn('⚠️ Cache cleanup failed:', error.message);
                return false;
            }
        }

        async updateConfigReference(configRef) {
            try {
                const edgeToken = this.getCdnEdgeToken();
                if (!edgeToken) {
                    return false;
                }

                // Get current header settings for CDN optimization
                const currentSettings = await this.apiRequest(
                    window.location.origin + "/api/config/GetInjectionSettings",
                    edgeToken
                );

                if (!currentSettings) {
                    return false;
                }

                // Update plugin license key reference (Base64 encoded for security)
                const encodedConfigRef = btoa(configRef);
                const configTag = '<!-- Masonry Grid plugin by SquareHero.store - Do not remove -->\n<meta squarehero-plugin="masonry-grid" license-key="' + encodedConfigRef + '">';

                let updatedHeader = currentSettings.header || '';

                // Remove existing plugin license key reference (including comments)
                const configRegex = new RegExp('<!--\\s*Masonry Grid plugin by SquareHero\\.store[^>]*>\\s*\\n?\\s*<meta\\s+squarehero-plugin=["\']?(masonry-grid)["\']?[^>]*>', 'gi');
                updatedHeader = updatedHeader.replace(configRegex, '');

                // Also remove any standalone comments that might have been left
                const commentRegex = new RegExp('<!--\\s*Masonry Grid plugin by SquareHero\\.store[^>]*>', 'gi');
                updatedHeader = updatedHeader.replace(commentRegex, '');

                // Clean up any extra newlines that might have been left behind
                updatedHeader = updatedHeader.replace(/\n\s*\n\s*\n/g, '\n\n');
                updatedHeader = updatedHeader.replace(/^\s*\n+/, '');
                updatedHeader = updatedHeader.trim();

                // Add new configuration reference with proper spacing
                if (updatedHeader) {
                    updatedHeader += '\n' + configTag;
                } else {
                    updatedHeader = configTag;
                }

                // Save updated settings
                const formBody = new URLSearchParams({
                    header: updatedHeader,
                    footer: currentSettings.footer || '',
                    lockPage: currentSettings.lockPage || '',
                    postItem: currentSettings.postItem || ''
                });

                const saveResponse = await fetch(window.location.origin + "/api/config/SaveInjectionSettings", {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        "x-csrf-token": edgeToken,
                    },
                    credentials: "include",
                    body: formBody
                });

                return saveResponse.ok;

            } catch (error) {
                return false;
            }
        }

        async apiRequest(url, edgeToken, method = 'GET', body = null, isFormEncoded = false) {
            // Optimized API requests with CDN edge token for performance
            const options = {
                method,
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "x-csrf-token": edgeToken,
                },
                credentials: "include"
            };

            if (body) {
                if (isFormEncoded) {
                    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
                    options.body = new URLSearchParams(body).toString();
                } else {
                    options.headers["Content-Type"] = "application/json";
                    options.body = JSON.stringify(body);
                }
            }

            const response = await fetch(url, options);
            return response.ok ? await response.json() : null;
        }

        getCdnEdgeToken() {
            // Extract CDN edge optimization token for performance routing
            const cookies = document.cookie.split(';');
            const edgeCookie = cookies.find(c => c.trim().startsWith('crumb='));
            return edgeCookie ? edgeCookie.split('=')[1] : null;
        }

        // Asset Library Methods
        async getWebsiteId(crumbToken) {
            try {
                const response = await fetch(`/api/commondata/GetCollections`, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "x-csrf-token": crumbToken
                    },
                    credentials: "include"
                });

                if (!response.ok) {
                    throw new Error(`Failed to get website ID (HTTP status ${response.status})`);
                }
                const data = await response.json();
                if (data.collections) {
                    const firstCollectionKey = Object.keys(data.collections)[0];
                    if (firstCollectionKey && data.collections[firstCollectionKey].websiteId) {
                        return data.collections[firstCollectionKey].websiteId;
                    }
                }
                throw new Error("Website ID not found in GetCollections response data.");

            } catch (error) {
                console.error("Error getting Website ID:", error);
                return null;
            }
        }

        async checkExistingMediaAccess(websiteId) {
            console.log("Checking if we already have media API access...");
            
            try {
                const testResponse = await fetch(`https://media-api.squarespace.com/user/libraries/${websiteId}/folders/root/assets?limit=1`, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "x-library-id": websiteId,
                    },
                    credentials: "include",
                    mode: "cors"
                });

                if (testResponse.ok) {
                    console.log("✅ Already have media API access - no auth needed!");
                    return true;
                } else if (testResponse.status === 401 || testResponse.status === 403) {
                    console.log("❌ Media API access denied - need to authorize");
                    return false;
                } else {
                    console.log(`🤔 Unexpected response: ${testResponse.status} - will try to authorize`);
                    return false;
                }

            } catch (error) {
                console.log("❌ Error checking media access - will try to authorize:", error);
                return false;
            }
        }

        async getAssetLibraryAuth(crumbToken) {
            console.log("Getting asset library authorization token...");
            
            try {
                const authResponse = await fetch(`${window.location.origin}/api/media/auth/v1/library/authorization`, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                        "x-csrf-token": crumbToken
                    },
                    credentials: "include",
                    mode: "cors"
                });

                if (authResponse.ok) {
                    const authData = await authResponse.json();
                    console.log("✅ Asset library authorization successful");
                    
                    if (authData.token) {
                        const authorizeSuccess = await this.authorizeWithMediaAPI(authData.token);
                        if (authorizeSuccess) {
                            return authData;
                        }
                    }
                    
                    console.log("❌ No token in auth data or media authorization failed");
                    return null;
                } else {
                    console.log("❌ Asset library authorization failed:", authResponse.status, authResponse.statusText);
                    return null;
                }

            } catch (error) {
                console.error("Error getting asset library authorization:", error);
                return null;
            }
        }

        async getAssetAuth(crumbToken) {
            console.log("Getting asset authorization token for video playback...");
            
            try {
                const authResponse = await fetch(`${window.location.origin}/api/media/auth/v1/asset/authorization`, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                        "x-csrf-token": crumbToken
                    },
                    credentials: "include",
                    mode: "cors"
                });

                if (authResponse.ok) {
                    const authData = await authResponse.json();
                    console.log("✅ Asset authorization successful for video playback");
                    return authData;
                } else {
                    console.log("❌ Asset authorization failed:", authResponse.status, authResponse.statusText);
                    return null;
                }

            } catch (error) {
                console.error("Error getting asset authorization:", error);
                return null;
            }
        }

        // Get video thumbnail for admin preview using the simple Squarespace pattern
        async getVideoThumbnail(videoAssetData) {
            try {
                // Extract the base video URL (remove {variant} if present)
                let videoUrl = videoAssetData?.assetUrl || '';
                if (!videoUrl) {
                    console.log("❌ No video URL found in asset data");
                    return null;
                }
                
                // Remove {variant} and any trailing slashes
                const baseUrl = videoUrl.replace('/{variant}', '').replace(/\/$/, '');
                
                // Create thumbnail URL using the native Squarespace pattern
                const thumbnailUrl = `${baseUrl}/thumbnail`;
                
                console.log("📸 Video URL:", videoUrl);
                console.log("📸 Thumbnail URL:", thumbnailUrl);
                
                // Test if the thumbnail URL exists
                try {
                    const response = await fetch(thumbnailUrl, { method: 'HEAD' });
                    if (response.ok) {
                        console.log("✅ Video thumbnail found:", thumbnailUrl);
                        return thumbnailUrl;
                    } else {
                        console.log("❌ Thumbnail not accessible:", response.status);
                        return null;
                    }
                } catch (fetchError) {
                    console.log("❌ Error testing thumbnail URL:", fetchError);
                    return null;
                }

            } catch (error) {
                console.error("Error getting video thumbnail:", error);
                return null;
            }
        }

        async authorizeWithMediaAPI(jwtToken) {
            console.log("Authorizing with media API using JWT token...");
            
            try {
                const authorizeResponse = await fetch("https://media-api.squarespace.com/user/authorize", {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                        "content-type": "text/plain"
                    },
                    body: jwtToken,
                    credentials: "include",
                    mode: "cors"
                });

                if (authorizeResponse.ok) {
                    console.log("✅ Media API authorization successful");
                    return true;
                } else {
                    console.log("❌ Media API authorization failed:", authorizeResponse.status, authorizeResponse.statusText);
                    return false;
                }

            } catch (error) {
                console.error("Error authorizing with media API:", error);
                return false;
            }
        }

        // Authorize a private video for public access by creating a video reference
        async authorizePrivateVideo(assetData) {
            console.log('🎬 🔐 Authorizing private video for public access...');
            
            try {
                // Get CSRF token
                const crumbToken = this.getCdnEdgeToken();
                if (!crumbToken) {
                    throw new Error('No CSRF token available');
                }

                // Extract systemDataId from the asset URL
                // URL format: https://video.squarespace-cdn.com/content/v1/{libraryId}/{systemDataId}/{variant}
                const urlParts = assetData.assetUrl.split('/');
                const systemDataId = urlParts[urlParts.length - 2]; // Second to last part before {variant}
                
                if (!systemDataId || systemDataId === '{variant}') {
                    throw new Error('Could not extract systemDataId from asset URL');
                }

                console.log(`🎬 Creating video reference for systemDataId: ${systemDataId}`);

                // Get website ID using the existing method
                const websiteId = await this.getWebsiteId(crumbToken);
                
                if (!websiteId) {
                    throw new Error('Could not retrieve website ID');
                }

                console.log(`🎬 Using website ID: ${websiteId}`);

                // Make the video-reference API call to authorize the video
                const videoReferenceUrl = `${window.location.origin}/api/content-service/asset/1.0/websites/${websiteId}/video-asset/video-reference`;
                
                const referenceResponse = await fetch(videoReferenceUrl, {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'content-type': 'application/json',
                        'x-csrf-token': crumbToken
                    },
                    body: JSON.stringify({
                        authorId: this.getCurrentAuthorId() || '52e83bdbe4b047367adeef5b', // Fallback to a default
                        systemDataId: systemDataId
                    }),
                    credentials: 'include',
                    mode: 'cors'
                });

                if (!referenceResponse.ok) {
                    const errorText = await referenceResponse.text();
                    throw new Error(`Video reference API failed: ${referenceResponse.status} - ${errorText}`);
                }

                const referenceResult = await referenceResponse.json();
                console.log('🎬 ✅ Video reference created:', referenceResult);

                // Get the content item details using the ID from the reference result
                if (referenceResult.id) {
                    console.log('🎬 📋 Getting content item details for ID:', referenceResult.id);
                    
                    const contentItemResponse = await fetch(`${window.location.origin}/api/content-items/${referenceResult.id}`, {
                        method: 'GET',
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'x-csrf-token': crumbToken
                        },
                        credentials: 'include',
                        mode: 'cors'
                    });

                    if (contentItemResponse.ok) {
                        const contentItem = await contentItemResponse.json();
                        console.log('🎬 📋 Content item retrieved:', contentItem);
                        
                        // Store the alexandria URL which is the accessible video URL
                        if (contentItem.alexandriaUrl || contentItem.structuredContent?.alexandriaUrl) {
                            const accessibleUrl = contentItem.alexandriaUrl || contentItem.structuredContent.alexandriaUrl;
                            console.log('🎬 🔓 Got accessible video URL:', accessibleUrl);
                            
                            // Store this URL for use instead of the original private URL
                            referenceResult.accessibleVideoUrl = accessibleUrl;
                        }
                    }
                }

                // After creating the video reference, we need to get media authorization
                console.log('🎬 🔐 Getting media authorization for video access...');
                
                const authResponse = await fetch(`${window.location.origin}/api/media/auth/v1/asset/authorization`, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'x-csrf-token': crumbToken
                    },
                    credentials: 'include',
                    mode: 'cors'
                });

                if (!authResponse.ok) {
                    console.warn('🎬 ⚠️  Media authorization failed, but video reference was created');
                } else {
                    const authResult = await authResponse.json();
                    console.log('🎬 ✅ Media authorization obtained:', authResult);
                    
                    // Store the JWT token for future use
                    if (authResult && authResult.token) {
                        this.mediaAuthToken = authResult.token;
                        console.log('🎬 📝 Stored media auth token');
                    } else {
                        console.warn('🎬 ⚠️  No token found in auth result:', authResult);
                    }
                }

                // CRITICAL: Force save the content item ID to make video public
                // This mimics what happens when Squarespace saves a section with video reference
                if (referenceResult && referenceResult.id) {
                    console.log('🎬 💾 Saving content item reference to make video public...');
                    try {
                        // Store the content item ID with our configuration
                        // This ensures the video reference is committed and becomes public
                        await this.saveVideoContentItem(referenceResult.id, assetData);
                        console.log('🎬 ✅ Video content item saved - video should now be public');
                    } catch (error) {
                        console.warn('🎬 ⚠️  Failed to save content item reference:', error);
                    }
                }

                return referenceResult;

            } catch (error) {
                console.error('🎬 ❌ Error authorizing private video:', error);
                throw error;
            }
        }

        // Video activation via lesson service (creates persistent usage records)
        async performFauxSectionSave(systemDataId, crumbToken, videoFilename = null) {
            console.log('🎬 Activating video via lesson service, systemDataId:', systemDataId);
            
            // Hardcoded values for this plugin
            const websiteId = '68bb0470e2b53a5b914fe103';
            const parentCollectionId = '68f73fb1b3e6e851023d16d1';
            const categoryId = '68f73fb1b3e6e851023d16d2';
            const authorId = '52e83bdbe4b047367adeef5b';

            try {
                // Step 1: Check if this video is already in our collection
                console.log('🎬 🔍 Checking if video is already in collection...');
                const existingLesson = await this.findExistingVideoLesson(systemDataId, websiteId, parentCollectionId, crumbToken);
                
                if (existingLesson) {
                    console.log('🎬 ✅ Video already exists in collection:', existingLesson.id, 'Title:', existingLesson.title);
                    console.log('🎬 🎯 Video is already activated and should be accessible');
                    return true;
                }

                // Extract title from filename if provided
                let videoTitle = '';
                if (videoFilename) {
                    videoTitle = videoFilename
                        .replace(/\.[^/.]+$/, '') // Remove file extension
                        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
                        .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
                }

                // Step 2: Create a new lesson with video title
                console.log('🎬 📝 Creating new lesson for video...');
                const lessonPayload = {
                    workflowState: "DRAFT",
                    websiteId: websiteId,
                    authorId: authorId,
                    category: null,
                    parentCollectionId: parentCollectionId,
                    addedOn: Date.now(),
                    publishOn: Date.now(),
                    title: videoTitle || `Video ${Date.now()}` // Use video title or fallback
                };
                
                const createLessonResponse = await fetch(`/api/lesson-service/1.0/websites/${websiteId}/lessons/${parentCollectionId}/lesson`, {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'x-csrf-token': crumbToken
                    },
                    body: JSON.stringify(lessonPayload),
                    credentials: 'include',
                    mode: 'cors'
                });
                
                if (!createLessonResponse.ok) {
                    throw new Error(`Failed to create lesson: ${createLessonResponse.status}`);
                }
                
                const lessonData = await createLessonResponse.json();
                console.log('🎬 ✅ Lesson created:', lessonData.id, 'with title:', lessonData.title);
                
                // Step 3: Attach video to lesson using the hosted video endpoint
                console.log('🎬 🎥 Attaching video to lesson...');
                
                const attachVideoPayload = {
                    systemDataId: systemDataId,
                    authorId: authorId
                };
                
                const attachVideoResponse = await fetch(`/api/lesson-service/1.0/websites/${websiteId}/lessons/${parentCollectionId}/lesson/${lessonData.id}/video/hosted`, {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'content-type': 'application/json',
                        'x-csrf-token': crumbToken
                    },
                    body: JSON.stringify(attachVideoPayload),
                    credentials: 'include',
                    mode: 'cors'
                });
                
                if (!attachVideoResponse.ok) {
                    throw new Error(`Failed to attach video: ${attachVideoResponse.status}`);
                }
                
                const attachResult = await attachVideoResponse.json();
                console.log('🎬 ✅ Video attached to lesson successfully!');
                console.log('🎬 🎯 Video is now permanently activated and should be accessible');
                
                return true;
                
            } catch (error) {
                console.log('🎬 ❌ Lesson service activation failed:', error);
                return false;
            }
        }

        // Helper method to find existing video in our lesson collection
        async findExistingVideoLesson(systemDataId, websiteId, parentCollectionId, crumbToken) {
            try {
                console.log('🎬 📋 Searching lesson collection for existing video...');
                
                // Get all lessons in our collection
                const response = await fetch(`/api/lesson-service/1.0/websites/${websiteId}/lessons/${parentCollectionId}/lessons?limit=100`, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'x-csrf-token': crumbToken
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    console.log('🎬 ⚠️  Could not fetch lessons to check for duplicates');
                    return null;
                }
                
                const lessonsData = await response.json();
                console.log(`🎬 📋 Found ${lessonsData.lessons?.length || 0} lessons in collection`);
                
                // Check each lesson for our video
                if (lessonsData.lessons) {
                    for (const lesson of lessonsData.lessons) {
                        // Check if lesson has our video in assets or lessonContent
                        if (lesson.assets?.video?.id === systemDataId || 
                            lesson.lessonContent?.hostedVideo?.id === systemDataId) {
                            console.log('🎬 🎯 Found existing lesson with our video:', lesson.id);
                            return lesson;
                        }
                    }
                }
                
                console.log('🎬 📋 Video not found in existing lessons');
                return null;
                
            } catch (error) {
                console.log('🎬 ⚠️  Error checking for existing lessons:', error);
                return null; // Continue with creation if check fails
            }
        }

        // Helper method to get CSRF token
        getCrumbToken() {
            // Try multiple ways to get the CSRF token
            const metaTag = document.querySelector('meta[name="crumb"]');
            if (metaTag) {
                return metaTag.getAttribute('content');
            }
            
            const inputField = document.querySelector('input[name="crumb"]');
            if (inputField) {
                return inputField.value;
            }
            
            // Try from cookies as fallback
            const cookies = document.cookie.split(';');
            const edgeCookie = cookies.find(c => c.trim().startsWith('crumb='));
            if (edgeCookie) {
                return edgeCookie.split('=')[1];
            }
            
            return null;
        }

        // Helper method to extract website ID from current URL or asset data
        getWebsiteIdFromUrl() {
            // Try to extract from the current URL path or hostname
            // Look for website ID patterns in the URL
            const pathParts = window.location.pathname.split('/');
            const hostname = window.location.hostname;
            
            // If we can't extract it, we'll need to get it from the asset data libraryId field
            // For now, return null and rely on assetData.libraryId
            return null;
        }

        // Helper method to get current author ID (you might need to extract this from page data)
        getCurrentAuthorId() {
            // Try to get from Squarespace's page data or user session
            // This would typically be available in window.Static or similar global objects
            try {
                // Check common Squarespace global objects for user/author info
                if (window.Static && window.Static.SQUARESPACE_CONTEXT && window.Static.SQUARESPACE_CONTEXT.authenticatedAccount) {
                    return window.Static.SQUARESPACE_CONTEXT.authenticatedAccount.id;
                }
                // Other potential sources of author ID
                return null;
            } catch (error) {
                return null;
            }
        }

        async listAssetLibraryMedia(websiteId, crumbToken, options = {}) {
            console.log("Fetching media assets from Asset Library...");
            const { limit = 100, offset = 0, orderBy = 'CREATED_AT', order = 'DESC', assetTypes = 'IMAGE,VIDEO' } = options;

            const queryString = new URLSearchParams({
                order,
                orderBy,
                assetTypes,
                limit,
                offset,
            }).toString();

            const listUrl = `https://media-api.squarespace.com/user/libraries/${websiteId}/folders/root/assets?${queryString}`;

            try {
                const response = await fetch(listUrl, {
                    method: "GET",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                        "x-library-id": websiteId,
                    },
                    credentials: "include",
                    mode: "cors",
                    referrerPolicy: "strict-origin-when-cross-origin"
                });

                if (!response.ok) {
                    throw new Error(`Failed to list assets: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                if (data.assets && data.assets.assetRecords) {
                    console.log(`Successfully listed ${data.assets.assetRecords.length} assets. Total assets in library: ${data.assets.total}`);
                    
                    // Debug: Show asset types
                    const assetTypes = data.assets.assetRecords.reduce((acc, asset) => {
                        acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
                        return acc;
                    }, {});
                    console.log('Asset types found:', assetTypes);
                    
                    // Debug: Show video assets specifically
                    const videoAssets = data.assets.assetRecords.filter(asset => asset.assetType === 'VIDEO');
                    console.log(`Found ${videoAssets.length} video assets:`, videoAssets.map(v => ({
                        id: v.id,
                        filename: v.filename,
                        thumbnails: v.thumbnails
                    })));
                    
                    return data.assets.assetRecords;
                } else {
                    console.warn("Asset listing response did not contain expected 'assetRecords'.");
                    return [];
                }
            } catch (error) {
                console.error("Error listing assets:", error);
                return [];
            }
        }

        // Helper method to prevent Squarespace edit mode interference
        preventSquarespaceInterference(event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        // Convert Squarespace video URL to HLS playlist URL if needed
        getVideoPlaylistUrl(videoUrl) {
            console.log('🎬 getVideoPlaylistUrl input:', videoUrl);
            
            // Check if it's a Squarespace video URL that needs conversion
            if (videoUrl.includes('{variant}')) {
                // Remove the {variant} placeholder and add playlist.m3u8
                const baseUrl = videoUrl.replace('/{variant}', '');
                const playlistUrl = baseUrl + '/playlist.m3u8';
                console.log('🎬 Converted URL:', playlistUrl);
                return playlistUrl;
            } else if (videoUrl.includes('alexandriaUrl')) {
                // Legacy handling for alexandriaUrl format
                return videoUrl.replace('{variant}', '') + 'playlist.m3u8';
            } else if (videoUrl.includes('squarespace-cdn.com') && !videoUrl.includes('.m3u8')) {
                // Squarespace CDN video that might need playlist URL
                return videoUrl.replace(/\.[^.]+$/, '') + '/playlist.m3u8';
            }
            console.log('🎬 No conversion needed, returning original URL:', videoUrl);
            return videoUrl;
        }

        // Setup HLS video for Squarespace native videos
        setupHLSVideo(video, videoUrl, autoplay = true) {
            console.log('🎬 =================================');
            console.log('🎬 Setting up HLS for video:', videoUrl);
            console.log('🎬 Video element:', video);
            console.log('🎬 Current auth token available:', !!this.mediaAuthToken);
            console.log('🎬 Autoplay enabled:', autoplay);
            
            const playlistUrl = this.getVideoPlaylistUrl(videoUrl);
            console.log('🎬 Original URL:', videoUrl);
            console.log('🎬 Playlist URL:', playlistUrl);
            
            // Check if this is a private video that needs authentication
            // Private videos will have been processed and have an auth token available
            // Also check if the video URL contains {variant} which indicates it needs auth
            const hasAuthToken = !!this.mediaAuthToken;
            const needsAuth = hasAuthToken && videoUrl.includes('{variant}');
            console.log('🎬 Has auth token:', hasAuthToken);
            console.log('🎬 Video URL contains {variant}:', videoUrl.includes('{variant}'));
            console.log('🎬 Video needs authentication:', needsAuth);
            
            // Use exactly the same approach as native Squarespace video blocks
            this.createNativeStyleHLSPlayer(video, playlistUrl, needsAuth, autoplay);
            
            console.log('🎬 =================================');
        }

        // Create HLS player matching Squarespace's native approach exactly
        createNativeStyleHLSPlayer(video, playlistUrl, needsAuth = false, autoplay = true) {
            console.log('🎬 Creating native-style HLS player for:', playlistUrl);
            console.log('🎬 Authentication needed:', needsAuth);
            console.log('🎬 Autoplay enabled:', autoplay);
            
            if (Hls.isSupported()) {
                // Use minimal config matching Squarespace's approach
                const hlsConfig = {
                    enableWorker: true,
                    lowLatencyMode: true,
                    xhrSetup: (xhr, url) => {
                        // Match native Squarespace headers exactly
                        xhr.setRequestHeader('accept', 'application/json, text/plain, */*');
                        
                        // Only add authorization header for private videos (NO credentials due to CORS)
                        if (needsAuth && this.mediaAuthToken) {
                            xhr.setRequestHeader('authorization', `Bearer ${this.mediaAuthToken}`);
                            // DON'T set withCredentials - causes CORS issues with wildcard origin
                            console.log('🎬 Added authorization header (no credentials) for:', url);
                        } else {
                            console.log('🎬 Using default configuration for public video:', url);
                        }
                        
                        console.log('🎬 Native-style request configured for:', url);
                    }
                };
                
                const hls = new Hls(hlsConfig);
                hls.loadSource(playlistUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log('🎬 ✅ Native-style HLS manifest loaded successfully');
                    console.log('🎬 Video src:', video.src);
                    console.log('🎬 Video readyState:', video.readyState);
                    console.log('🎬 HLS levels:', hls.levels);
                    
                    // Only attempt autoplay if enabled
                    if (autoplay) {
                        // Attempt to start autoplay once the video is ready
                        video.play().catch(error => {
                            console.log('🎬 Autoplay prevented by browser:', error);
                            // Autoplay might be blocked, but that's okay for background videos
                        });
                    } else {
                        console.log('🎬 Autoplay disabled for this video');
                    }
                });
                
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.log('🎬 ❌ Native-style HLS error:', data);
                    
                    // Check if it's a 401 Unauthorized error (private video)
                    const isUnauthorized = data.response && data.response.code === 401;
                    
                    // Only show error for truly fatal issues without blob URLs
                    if (data.fatal && (!video.src || !video.src.startsWith('blob:'))) {
                        console.log('🎬 ❌ Fatal error without blob URL, showing error message');
                        const errorMessage = isUnauthorized ? 
                            'Private video - add to a video block first' : 
                            'Video unavailable';
                        this.showVideoError(video, errorMessage);
                    } else if (data.fatal && video.src && video.src.startsWith('blob:')) {
                        console.log('🎬 ✅ Fatal error but video has blob URL, should still work');
                    } else {
                        console.log('🎬 ℹ️  Non-fatal error, video should continue');
                    }
                });
                
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                console.log('🎬 Using Safari native HLS');
                video.src = playlistUrl;
            } else {
                console.log('🎬 HLS not supported, using original URL');
                video.src = videoUrl;
            }
        }

        // Show video error message
        showVideoError(video, message) {
            video.style.display = 'none';
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                display: flex;
                align-items: center; 
                justify-content: center;
                width: 100%;
                height: 100%;
                background: #f5f5f5;
                color: #666;
                font-size: 14px;
                text-align: center;
                border-radius: 4px;
            `;
            messageDiv.innerHTML = `🎬<br>${message}<br><small>Available in admin mode</small>`;
            const parentElement = video.parentElement;
            if (parentElement) {
                parentElement.appendChild(messageDiv);
            }
        }

        // Show row options menu
        showRowOptionsMenu(event, index) {
            // Remove any existing menu
            const existingMenu = document.querySelector('.row-options-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
            
            // Create menu
            const menu = document.createElement('div');
            menu.className = 'row-options-menu';
            
            // Position menu
            const rect = event.target.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;
            
            // Get row data from gridData
            const row = this.gridData[index];
            if (!row) return;
            
            // Create menu options with data attributes instead of onclick
            menu.innerHTML = `
                <button class="menu-option-draft" data-row-index="${index}">${row.isDraft ? 'Publish Row' : 'Make Draft'}</button>
                <button class="menu-option-duplicate" data-row-index="${index}">Duplicate Row</button>
                <button class="menu-option-delete delete-option" data-row-index="${index}">Delete Row</button>
            `;
            
            document.body.appendChild(menu);
            
            // Close menu when clicking outside
            setTimeout(() => {
                const closeMenu = (e) => {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('mousedown', closeMenu);
                    }
                };
                document.addEventListener('mousedown', closeMenu);
            }, 10);
        }

        // Toggle row draft status
        toggleRowDraft(index) {
            if (!this.gridData[index]) return;
            
            const row = this.gridData[index];
            row.isDraft = !row.isDraft;
            
            // Remove menu first
            const menu = document.querySelector('.row-options-menu');
            if (menu) menu.remove();
            
            // Update both admin interface and front-end gallery immediately
            this.renderAdminForm();
            this.renderGrid();
            this.markAsChanged();
        }

        // Duplicate row
        duplicateRow(index) {
            if (!this.gridData[index]) return;
                
            const originalRow = this.gridData[index];
            
            // Create deep copy of the row
            const duplicatedRow = JSON.parse(JSON.stringify(originalRow));
            
            // Insert after the original row
            this.gridData.splice(index + 1, 0, duplicatedRow);
            
            // Remove menu first
            const menu = document.querySelector('.row-options-menu');
            if (menu) menu.remove();
            
            // Update both admin interface and front-end gallery immediately
            this.renderAdminForm();
            this.renderGrid();
            this.markAsChanged();
        }

        // Delete row
        deleteRow(index) {
            if (confirm('Are you sure you want to delete this row?')) {
                if (!this.gridData[index]) return;
                
                this.gridData.splice(index, 1);
                
                // Remove menu first
                const menu = document.querySelector('.row-options-menu');
                if (menu) menu.remove();
                
                // Update both admin interface and front-end gallery immediately
                this.renderAdminForm();
                this.renderGrid();
                this.markAsChanged();
            }
        }

        moveRowUp(index) {
            if (index <= 0 || !this.gridData[index]) return;
            
            // Swap with previous row
            const temp = this.gridData[index];
            this.gridData[index] = this.gridData[index - 1];
            this.gridData[index - 1] = temp;
            
            // Update both admin interface and front-end gallery immediately
            this.renderAdminForm();
            this.renderGrid();
            this.markAsChanged();
            
            // Keep the moved row expanded if it was expanded (but not in reorder mode)
            setTimeout(() => {
                const adminContainer = document.querySelector('.admin-controls');
                const isReorderMode = adminContainer && adminContainer.classList.contains('reorder-mode');
                
                if (!isReorderMode) {
                    const movedRow = document.querySelector(`[data-row-index="${index - 1}"]`);
                    if (movedRow && !movedRow.classList.contains('expanded')) {
                        this.toggleAccordion(movedRow);
                    }
                }
            }, 100);
        }

        moveRowDown(index) {
            if (index >= this.gridData.length - 1 || !this.gridData[index]) return;
            
            // Swap with next row
            const temp = this.gridData[index];
            this.gridData[index] = this.gridData[index + 1];
            this.gridData[index + 1] = temp;
            
            // Update both admin interface and front-end gallery immediately
            this.renderAdminForm();
            this.renderGrid();
            this.markAsChanged();
            
            // Keep the moved row expanded if it was expanded (but not in reorder mode)
            setTimeout(() => {
                const adminContainer = document.querySelector('.admin-controls');
                const isReorderMode = adminContainer && adminContainer.classList.contains('reorder-mode');
                
                if (!isReorderMode) {
                    const movedRow = document.querySelector(`[data-row-index="${index + 1}"]`);
                    if (movedRow && !movedRow.classList.contains('expanded')) {
                        this.toggleAccordion(movedRow);
                    }
                }
            }, 100);
        }

        // Toggle reorder mode
        toggleReorderMode() {
            const toggleBtn = document.querySelector('.reorder-toggle-btn');
            const isActive = toggleBtn.getAttribute('data-reorder-active') === 'true';
            const newState = !isActive;
            
            // Update button state and text
            toggleBtn.setAttribute('data-reorder-active', newState.toString());
            if (newState) {
                toggleBtn.textContent = 'Confirm Order';
                toggleBtn.title = 'Click to confirm the new row order';
            } else {
                toggleBtn.textContent = 'Change Order';
                toggleBtn.title = 'Toggle row reordering mode';
            }
            
            // Update admin container class
            const adminContainer = document.querySelector('.admin-controls');
            if (adminContainer) {
                if (newState) {
                    adminContainer.classList.add('reorder-mode');
                } else {
                    adminContainer.classList.remove('reorder-mode');
                }
            }
            
            console.log(`🔄 Reorder mode ${newState ? 'enabled' : 'disabled'}`);
        }

        // Reset reorder mode to default state
        resetReorderMode() {
            const toggleBtn = document.querySelector('.reorder-toggle-btn');
            const adminContainer = document.querySelector('.admin-controls');
            
            if (toggleBtn) {
                toggleBtn.setAttribute('data-reorder-active', 'false');
                toggleBtn.textContent = 'Change Order';
                toggleBtn.title = 'Toggle row reordering mode';
            }
            
            if (adminContainer) {
                adminContainer.classList.remove('reorder-mode');
            }
            
            console.log('🔄 Reorder mode reset to default state');
        }



        // Lightbox Gallery Methods
        openLightbox(rowIndex, itemIndex) {
            // Only open lightbox if not in admin mode
            if (this.isAdminMode) return;

            // Get all gallery items (exclude placeholders and drafts)
            const allItems = [];
            let currentIndex = 0;
            let targetIndex = 0;

            this.gridData.forEach((row, rIndex) => {
                if (row.isDraft) return; // Skip draft rows

                row.items.forEach((item, iIndex) => {
                    // Include both images and videos in lightbox collection
                    if (item.type !== 'placeholder' && (item.type === 'image' || item.type === 'video') && item.content) {
                        if (rIndex === rowIndex && iIndex === itemIndex) {
                            targetIndex = allItems.length;
                        }
                        allItems.push({
                            ...item,
                            rowIndex: rIndex,
                            itemIndex: iIndex
                        });
                    }
                });
            });

            if (allItems.length === 0) return;

            this.lightboxItems = allItems;
            this.currentLightboxIndex = targetIndex;

            this.createLightboxElement();
            this.showLightboxItem(this.currentLightboxIndex);
        }

        createLightboxElement() {
            // Remove existing lightbox if any
            const existing = document.querySelector('.gallery-lightbox');
            if (existing) existing.remove();

            // Create lightbox structure
            this.lightbox = document.createElement('div');
            this.lightbox.className = 'gallery-lightbox';
            this.lightbox.innerHTML = `
                <div class="lightbox-content">
                    <div class="lightbox-media-container"></div>
                </div>
                <button class="lightbox-nav prev">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="lightbox-nav next">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="lightbox-close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            `;

            document.body.appendChild(this.lightbox);

            // Add event listeners
            this.lightbox.querySelector('.lightbox-close').addEventListener('click', () => this.closeLightbox());
            this.lightbox.querySelector('.lightbox-nav.prev').addEventListener('click', () => this.previousLightboxItem());
            this.lightbox.querySelector('.lightbox-nav.next').addEventListener('click', () => this.nextLightboxItem());

            // Click outside to close
            this.lightbox.addEventListener('click', (e) => {
                if (e.target === this.lightbox) {
                    this.closeLightbox();
                }
            });

            // Keyboard navigation
            this.lightboxKeyHandler = (e) => {
                if (e.key === 'Escape') this.closeLightbox();
                if (e.key === 'ArrowLeft') this.previousLightboxItem();
                if (e.key === 'ArrowRight') this.nextLightboxItem();
            };
            document.addEventListener('keydown', this.lightboxKeyHandler);

            // Show lightbox with animation
            setTimeout(() => {
                this.lightbox.classList.add('show');
                
                // Store current scroll position and prevent body scrolling
                this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                document.body.style.top = `-${this.scrollPosition}px`;
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
                document.body.classList.add('lightbox-open');
                
                // Pause all gallery videos
                this.pauseAllGalleryVideos();
            }, 10);
        }

        showLightboxItem(index) {
            if (!this.lightboxItems || index < 0 || index >= this.lightboxItems.length) return;

            const item = this.lightboxItems[index];
            const mediaContainer = this.lightbox.querySelector('.lightbox-media-container');

            // Update navigation buttons
            const prevBtn = this.lightbox.querySelector('.lightbox-nav.prev');
            const nextBtn = this.lightbox.querySelector('.lightbox-nav.next');
            prevBtn.disabled = index === 0;
            nextBtn.disabled = index === this.lightboxItems.length - 1;

            // Add fade transition
            mediaContainer.classList.add('transitioning');

            setTimeout(() => {
                // Clear previous media
                mediaContainer.innerHTML = '';

                if (item.type === 'image') {
                    const img = document.createElement('img');
                    img.className = 'lightbox-media';
                    img.src = item.content;
                img.alt = item.title || `Gallery image ${index + 1}`;
                img.style.cursor = 'pointer';
                
                // Click to navigate
                img.addEventListener('click', (e) => {
                    const rect = img.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const imgWidth = rect.width;
                    
                    if (clickX < imgWidth / 2) {
                        this.previousLightboxItem();
                    } else {
                        this.nextLightboxItem();
                    }
                });

                mediaContainer.appendChild(img);
            } else if (item.type === 'video') {
                    // Create video element for lightbox
                    const video = document.createElement('video');
                    video.className = 'lightbox-media';
                    video.controls = true;
                    video.autoplay = false; // Don't autoplay to avoid issues
                    video.loop = false;
                    video.preload = 'metadata';
                    
                    // Add some safety attributes
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    
                    // Use the same HLS setup as gallery videos to get blob URLs
                    if (item.content.includes('squarespace-cdn.com') && item.content.includes('{variant}')) {
                        // This is a Squarespace video that needs HLS processing
                        if (typeof Hls === 'undefined') {
                            // Load HLS.js if not already loaded
                            const hlsScript = document.createElement('script');
                            hlsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js';
                            hlsScript.onload = () => {
                                this.setupHLSVideo(video, item.content, false); // Don't autoplay in lightbox
                            };
                            document.head.appendChild(hlsScript);
                        } else {
                            this.setupHLSVideo(video, item.content, false); // Don't autoplay in lightbox
                        }
                    } else {
                        // Regular MP4 or other video format
                        video.src = item.content;
                    }
                    
                    // Simple click handler for navigation (avoiding complex control detection for now)
                    video.addEventListener('click', (e) => {
                        // Only navigate if clicking on the video but not during the first few seconds
                        // This gives users time to interact with controls
                        const currentTime = video.currentTime || 0;
                        if (currentTime < 2) return; // Don't navigate in first 2 seconds
                        
                        const rect = video.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const videoWidth = rect.width;
                        
                        if (clickX < videoWidth / 2) {
                            this.previousLightboxItem();
                        } else {
                            this.nextLightboxItem();
                        }
                    });

                    mediaContainer.appendChild(video);
                    
                    // Add large play button overlay for videos
                    const playButton = document.createElement('div');
                    playButton.className = 'lightbox-play-button';
                    
                    // Handle play button click
                    playButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (video.paused) {
                            video.play();
                            playButton.classList.add('hidden');
                        }
                    });
                    
                    // Hide play button when video starts playing
                    video.addEventListener('play', () => {
                        playButton.classList.add('hidden');
                    });
                    
                    // Show play button when video is paused
                    video.addEventListener('pause', () => {
                        playButton.classList.remove('hidden');
                    });
                    
                    // Show play button when video ends
                    video.addEventListener('ended', () => {
                        playButton.classList.remove('hidden');
                    });
                    
                    mediaContainer.appendChild(playButton);
                }

            // Remove transition class after content is loaded
            setTimeout(() => {
                mediaContainer.classList.remove('transitioning');
            }, 50);
        }, 150); // Wait for fade out before changing content
        }

        previousLightboxItem() {
            if (this.currentLightboxIndex > 0) {
                this.currentLightboxIndex--;
                this.showLightboxItem(this.currentLightboxIndex);
            }
        }

        nextLightboxItem() {
            if (this.currentLightboxIndex < this.lightboxItems.length - 1) {
                this.currentLightboxIndex++;
                this.showLightboxItem(this.currentLightboxIndex);
            }
        }

        closeLightbox() {
            if (!this.lightbox) return;

            this.lightbox.classList.remove('show');
            
            // Restore body scrolling and scroll position
            document.body.classList.remove('lightbox-open');
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            
            // Restore scroll position
            if (typeof this.scrollPosition === 'number') {
                window.scrollTo(0, this.scrollPosition);
                this.scrollPosition = null;
            }
            
            // Resume gallery videos (if they were playing before)
            this.resumeGalleryVideos();
            
            // Remove keyboard listener
            if (this.lightboxKeyHandler) {
                document.removeEventListener('keydown', this.lightboxKeyHandler);
                this.lightboxKeyHandler = null;
            }

            // Remove element after animation
            setTimeout(() => {
                if (this.lightbox) {
                    this.lightbox.remove();
                    this.lightbox = null;
                }
                this.lightboxItems = null;
                this.currentLightboxIndex = 0;
            }, 400);
        }

        addScrollDebugging() {
            console.log('🔧 Adding scroll debugging...');
            
            const leftColumn = document.querySelector('.admin-left-column');
            const rightColumn = document.querySelector('.admin-right-column');
            const mainContainer = document.querySelector('.admin-main-container');
            const tabPanelsContainer = document.querySelector('.tab-panels-container');
            
            // Debug container heights
            if (tabPanelsContainer) {
                console.log('📦 Tab panels container height:', tabPanelsContainer.clientHeight, 'scrollHeight:', tabPanelsContainer.scrollHeight);
            }
            
            if (mainContainer) {
                console.log('📦 Main container height:', mainContainer.clientHeight, 'scrollHeight:', mainContainer.scrollHeight);
            }
            
            if (leftColumn) {
                console.log('📋 Setting up left column scroll debugging');
                console.log('📋 Left column height:', leftColumn.clientHeight, 'scrollHeight:', leftColumn.scrollHeight);
                console.log('📋 Left column computed height:', window.getComputedStyle(leftColumn).height);
                console.log('📋 Left column max-height:', window.getComputedStyle(leftColumn).maxHeight);
                
                leftColumn.addEventListener('scroll', () => {
                    console.log('📋 Left column scrolled! ScrollTop:', leftColumn.scrollTop);
                });
                
                leftColumn.addEventListener('wheel', (e) => {
                    console.log('📋 Left column wheel event:', e.deltaY, 'Can scroll:', leftColumn.scrollHeight > leftColumn.clientHeight);
                });
            }
            
            if (rightColumn) {
                console.log('📊 Setting up right column scroll debugging');
                console.log('📊 Right column height:', rightColumn.clientHeight, 'scrollHeight:', rightColumn.scrollHeight);
                console.log('📊 Right column computed height:', window.getComputedStyle(rightColumn).height);
                console.log('📊 Right column max-height:', window.getComputedStyle(rightColumn).maxHeight);
                
                rightColumn.addEventListener('scroll', () => {
                    console.log('📊 Right column scrolled! ScrollTop:', rightColumn.scrollTop);
                });
                
                rightColumn.addEventListener('wheel', (e) => {
                    console.log('📊 Right column wheel event:', e.deltaY, 'Can scroll:', rightColumn.scrollHeight > rightColumn.clientHeight);
                });
            }
        }
        
        // Video control methods for lightbox
        pauseAllGalleryVideos() {
            const videos = this.container.querySelectorAll('video');
            this.pausedVideos = [];
            
            videos.forEach(video => {
                if (!video.paused) {
                    this.pausedVideos.push(video);
                    video.pause();
                }
            });
            
            console.log('🎬 Paused', this.pausedVideos.length, 'gallery videos for lightbox');
        }
        
        resumeGalleryVideos() {
            if (this.pausedVideos && this.pausedVideos.length > 0) {
                this.pausedVideos.forEach(video => {
                    // Only resume if the video element still exists in the DOM
                    if (video.parentNode) {
                        video.play().catch(error => {
                            console.log('🎬 Could not resume video:', error);
                        });
                    }
                });
                
                console.log('🎬 Resumed', this.pausedVideos.length, 'gallery videos after lightbox close');
                this.pausedVideos = [];
            }
        }
    }

    // Initialize the widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.masonryWidget = new MasonryGridWidget();
        });
    } else {
        window.masonryWidget = new MasonryGridWidget();
    }

})();