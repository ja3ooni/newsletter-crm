import { mockUser, validCreateUserRequest, validUpdateUserRequest } from './testData';

describe('Test Data Fixtures', () => {
  it('should have valid mock user data', () => {
    expect(mockUser).toBeDefined();
    expect(mockUser.id).toBe('user-123');
    expect(mockUser.email).toBe('test@example.com');
    expect(mockUser.profile).toBeDefined();
    expect(mockUser.preferences).toBeDefined();
    expect(mockUser.engagementMetrics).toBeDefined();
    expect(mockUser.status).toBe('active');
    expect(mockUser.emailVerified).toBe(true);
  });

  it('should have valid create user request data', () => {
    expect(validCreateUserRequest).toBeDefined();
    expect(validCreateUserRequest.email).toBe('newuser@example.com');
    expect(validCreateUserRequest.password).toBe('SecurePassword123!');
    expect(validCreateUserRequest.profile).toBeDefined();
    expect(validCreateUserRequest.profile.firstName).toBe('Jane');
    expect(validCreateUserRequest.profile.lastName).toBe('Smith');
  });

  it('should have valid update user request data', () => {
    expect(validUpdateUserRequest).toBeDefined();
    expect(validUpdateUserRequest.profile).toBeDefined();
    expect(validUpdateUserRequest.profile?.firstName).toBe('Jane');
    expect(validUpdateUserRequest.profile?.lastName).toBe('Doe');
    expect(validUpdateUserRequest.profile?.company).toBe('New Corp');
  });
});
