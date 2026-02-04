export interface User {
  id: string;
  publicKey: string;
}

export interface Username {
  id: string;
  isSearchable: boolean;
  userId: string;
  displayName: string;
  username: string;
}
