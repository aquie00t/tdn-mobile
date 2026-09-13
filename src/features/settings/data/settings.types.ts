/** What `GET /users/me` answers: the account, rather than the profile. */
export interface AccountInfo {
    id: string;
    username: string;
    email: string;
    isEmailVerified: boolean;
    /**
     * The OAuth providers linked to the account, as the API names them. Empty
     * for an account made with a password and nothing else.
     */
    providers: string[];
    createdAt: string;
    updatedAt: string;
    isBot?: boolean;
}

export interface UpdatePasswordBody {
    currentPassword: string;
    newPassword: string;
}
