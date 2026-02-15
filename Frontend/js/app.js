// Enhanced Modern Banking App
class CoreBankingApp {
    constructor() {
        this.API_BASE = '/api';
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupPreloader();
            this.setupNavigation();
            this.setupEventListeners();
            this.loadDashboard();
            this.setupAnimations();
        });
    }

    setupPreloader() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.getElementById('preloader').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('preloader').style.display = 'none';
                }, 500);
            }, 1000);
        });
    }

    setupNavigation() {
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        // Nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                this.showSection(target);
            });
        });
    }

    setupEventListeners() {
        // Forms
        document.getElementById('customerForm').addEventListener('submit', (e) => this.handleAddCustomer(e));
        document.getElementById('accountForm').addEventListener('submit', (e) => this.handleCreateAccount(e));
        document.getElementById('depositForm').addEventListener('submit', (e) => this.handleDeposit(e));
        document.getElementById('withdrawForm').addEventListener('submit', (e) => this.handleWithdraw(e));
        document.getElementById('transferForm').addEventListener('submit', (e) => this.handleTransfer(e));
    }

    setupAnimations() {
        // Intersection Observer for animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate__animated', 'animate__fadeInUp');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.stat-card, .modern-card').forEach(el => {
            observer.observe(el);
        });
    }

    async showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(sectionName).classList.add('active');
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${sectionName}"]`).classList.add('active');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Load section data
        switch(sectionName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'customers':
                await this.loadCustomers();
                break;
            case 'accounts':
                await this.loadAccounts();
                break;
            case 'transactions':
                await this.loadTransactions();
                break;
            case 'audit':
                await this.loadAuditLogs();
                break;
        }
        
        this.currentSection = sectionName;
    }

    // Loading utilities
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    // API call function
    async apiCall(endpoint, options = {}) {
        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification('Error: ' + error.message, 'danger');
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // Notification system
    showNotification(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 100px; right: 20px; z-index: 1000; min-width: 300px;';
        alert.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
                <div>${message}</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            danger: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Dashboard functions
    async loadDashboard() {
        try {
            const [customers, accounts, audit] = await Promise.all([
                this.apiCall('/customers'),
                this.apiCall('/accounts'),
                this.apiCall('/audit')
            ]);
            
            // Update hero stats
            document.getElementById('heroCustomers').textContent = customers.length;
            document.getElementById('heroAccounts').textContent = accounts.length;
            
            const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.Balance), 0);
            document.getElementById('heroBalance').textContent = this.formatCurrency(totalBalance);
            
            // Update dashboard stats
            document.getElementById('totalCustomers').textContent = customers.length;
            document.getElementById('totalAccounts').textContent = accounts.length;
            document.getElementById('totalBalance').textContent = this.formatCurrency(totalBalance);
            
            const today = new Date().toISOString().split('T')[0];
            const todayTransactions = audit.filter(log => 
                log.CreatedAt.includes(today) && 
                ['COMMIT', 'Success'].includes(log.Operation)
            ).length;
            document.getElementById('todayTransactions').textContent = todayTransactions;
            
            // Load recent activity
            this.loadRecentActivity(audit);
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    loadRecentActivity(auditLogs) {
        const activityList = document.getElementById('recentActivity');
        const recentActivities = auditLogs.slice(0, 5);
        
        activityList.innerHTML = recentActivities.map(log => `
            <div class="activity-item">
                <div class="activity-icon ${this.getActivityType(log.Operation)}">
                    <i class="fas fa-${this.getActivityIcon(log.Operation)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${log.Operation} - ${log.TableAffected}</div>
                    <div class="activity-desc">${log.Details || 'No details available'}</div>
                    <div class="activity-time">${new Date(log.CreatedAt).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    }

    getActivityType(operation) {
        const types = {
            'COMMIT': 'success',
            'ROLLBACK': 'warning',
            'INSERT': 'info',
            'UPDATE': 'warning',
            'DELETE': 'danger'
        };
        return types[operation] || 'info';
    }

    getActivityIcon(operation) {
        const icons = {
            'COMMIT': 'check-circle',
            'ROLLBACK': 'exclamation-triangle',
            'INSERT': 'plus-circle',
            'UPDATE': 'edit',
            'DELETE': 'trash'
        };
        return icons[operation] || 'info-circle';
    }

    // Customer functions
    async loadCustomers() {
        try {
            const customers = await this.apiCall('/customers');
            const tableBody = document.getElementById('customersTable');
            
            tableBody.innerHTML = customers.map(customer => `
                <tr>
                    <td><strong>#${customer.CustID}</strong></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="customer-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <div class="fw-bold">${customer.Name}</div>
                                <small class="text-muted">Customer</small>
                            </div>
                        </div>
                    </td>
                    <td>${customer.CNIC}</td>
                    <td>${customer.Contact}</td>
                    <td>${customer.Gmail}</td>
                    <td><span class="badge badge-success">Active</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="app.editCustomer(${customer.CustID})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

   // ...existing code...
    async handleAddCustomer(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('customerEmail') || document.getElementById('customerGmail');

        const formData = {
            name: document.getElementById('customerName').value,
            cnic: document.getElementById('customerCNIC').value,
            contact: document.getElementById('customerContact').value,
            gmail: emailInput ? emailInput.value : ''
        };
        
        try {
            const result = await this.apiCall('/customers', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            this.showNotification('Customer added successfully!', 'success');
            document.getElementById('customerForm').reset();
            this.loadCustomers();
            this.loadDashboard();
            
        } catch (error) {
            console.error('Error adding customer:', error);
        }
    }
// ...existing code...
    // Account functions
    async loadAccounts() {
        try {
            const accounts = await this.apiCall('/accounts');
            const tableBody = document.getElementById('accountsTable');
            
            tableBody.innerHTML = accounts.map(account => `
                <tr>
                    <td><strong>#${account.AccountNo}</strong></td>
                    <td>${account.CustID}</td>
                    <td>
                        <span class="badge ${account.Type === 'Savings' ? 'badge-success' : 'badge-info'}">
                            ${account.Type}
                        </span>
                    </td>
                    <td class="fw-bold">${this.formatCurrency(account.Balance)}</td>
                    <td>
                        <span class="badge ${account.Status === 'Active' ? 'badge-success' : 'badge-secondary'}">
                            ${account.Status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-info">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    async handleCreateAccount(e) {
        e.preventDefault();
        
        const formData = {
            custID: document.getElementById('accountCustomerID').value,
            type: document.getElementById('accountType').value,
            balance: document.getElementById('accountBalance').value
        };
        
        try {
            const result = await this.apiCall('/accounts', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            this.showNotification('Account created successfully!', 'success');
            document.getElementById('accountForm').reset();
            this.loadAccounts();
            this.loadDashboard();
            
        } catch (error) {
            console.error('Error creating account:', error);
        }
    }

    // Transaction functions
    async handleDeposit(e) {
        e.preventDefault();
        await this.processTransaction('deposit', e.target);
    }

    async handleWithdraw(e) {
        e.preventDefault();
        await this.processTransaction('withdraw', e.target);
    }

    async handleTransfer(e) {
        e.preventDefault();
        await this.processTransaction('transfer', e.target);
    }

    async processTransaction(type, form) {
        const formData = new FormData(form);
        const data = {
            accountNo: formData.get(type === 'transfer' ? 'fromAccount' : 'account'),
            amount: parseFloat(formData.get('amount')),
            user: formData.get('user')
        };
        
        if (type === 'transfer') {
            data.toAccount = formData.get('toAccount');
        }
        
        try {
            const result = await this.apiCall(`/transactions/${type}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (result.success) {
                this.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} completed successfully!`, 'success');
                this.displayTransactionResult(type, data, result);
                form.reset();
                this.loadDashboard();
            } else {
                throw new Error(result.error || 'Transaction failed');
            }
            
        } catch (error) {
            console.error(`Error processing ${type}:`, error);
            this.displayTransactionError(error.message);
        }
    }

    displayTransactionResult(type, data, result) {
        let resultHtml = `
            <div class="transaction-success">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h5>Transaction Successful</h5>
                <div class="transaction-details">
                    <div class="detail-item">
                        <span>Type:</span>
                        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    </div>
                    <div class="detail-item">
                        <span>Amount:</span>
                        <strong>${this.formatCurrency(data.amount)}</strong>
                    </div>
        `;
        
        if (type === 'deposit' && result.receiver) {
            resultHtml += `
                <div class="detail-item">
                    <span>Account:</span>
                    <strong>#${result.receiver.accountNo} (${result.receiver.name})</strong>
                </div>
                <div class="detail-item">
                    <span>New Balance:</span>
                    <strong>${this.formatCurrency(result.receiver.newBalance)}</strong>
                </div>
            `;
        } else if (type === 'withdraw' && result.sender) {
            resultHtml += `
                <div class="detail-item">
                    <span>Account:</span>
                    <strong>#${result.sender.accountNo} (${result.sender.name})</strong>
                </div>
                <div class="detail-item">
                    <span>New Balance:</span>
                    <strong>${this.formatCurrency(result.sender.newBalance)}</strong>
                </div>
            `;
        } else if (type === 'transfer' && result.sender && result.receiver) {
            resultHtml += `
                <div class="detail-item">
                    <span>From:</span>
                    <strong>#${result.sender.accountNo} (${result.sender.name})</strong>
                </div>
                <div class="detail-item">
                    <span>To:</span>
                    <strong>#${result.receiver.accountNo} (${result.receiver.name})</strong>
                </div>
                <div class="detail-item">
                    <span>Sender Balance:</span>
                    <strong>${this.formatCurrency(result.sender.newBalance)}</strong>
                </div>
                <div class="detail-item">
                    <span>Receiver Balance:</span>
                    <strong>${this.formatCurrency(result.receiver.newBalance)}</strong>
                </div>
            `;
        }
        
        resultHtml += `</div></div>`;
        document.getElementById('transactionResult').innerHTML = resultHtml;
    }

    displayTransactionError(message) {
        const errorHtml = `
            <div class="transaction-error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h5>Transaction Failed</h5>
                <div class="error-message">
                    <p>${message}</p>
                </div>
            </div>
        `;
        document.getElementById('transactionResult').innerHTML = errorHtml;
    }

    // Audit log functions
    async loadAuditLogs() {
        try {
            const auditLogs = await this.apiCall('/audit');
            const tableBody = document.getElementById('auditTable');
            
            tableBody.innerHTML = auditLogs.map(log => `
                <tr>
                    <td><strong>#${log.LogID}</strong></td>
                    <td>
                        <span class="badge ${
                            log.Operation === 'COMMIT' ? 'badge-success' : 
                            log.Operation === 'ROLLBACK' ? 'badge-danger' : 'badge-secondary'
                        }">
                            ${log.Operation}
                        </span>
                    </td>
                    <td>${log.TableAffected}</td>
                    <td>${log.RecordID || 'N/A'}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar-sm">
                                <i class="fas fa-user"></i>
                            </div>
                            <span>${log.UserName}</span>
                        </div>
                    </td>
                    <td>${log.Details || 'No details'}</td>
                    <td>${new Date(log.CreatedAt).toLocaleString()}</td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    }

    // Utility functions
    formatCurrency(amount) {
        return '₹' + parseFloat(amount).toLocaleString('en-IN');
    }

    editCustomer(customerId) {
        this.showNotification('Edit feature coming soon!', 'info');
    }
}

// Initialize the application
const app = new CoreBankingApp();

// Global functions for HTML onclick
window.showSection = (section) => app.showSection(section);
window.editCustomer = (id) => app.editCustomer(id);