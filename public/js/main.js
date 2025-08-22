// Global utility functions
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '20px';
  alertDiv.style.right = '20px';
  alertDiv.style.zIndex = '10000';
  alertDiv.style.borderRadius = '8px';
  alertDiv.style.padding = '12px 16px';
  alertDiv.style.boxShadow = 'var(--shadow-raised)';
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 3000);
}

// Initialize any global functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Dante Platform loaded successfully!');
});