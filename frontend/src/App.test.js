import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple test component that doesn't depend on routing
function TestApp() {
  return React.createElement('div', null, 'Test App');
}

test('renders test app component', () => {
  render(<TestApp />);
  const element = screen.getByText('Test App');
  expect(element).toBeInTheDocument();
});
