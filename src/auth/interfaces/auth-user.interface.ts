export interface AuthUser {
  sub: string;
  sid: string;
  roles: string[];
  type: 'access';
  iat?: number;
  exp?: number;
}