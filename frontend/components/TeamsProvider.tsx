'use client';

import { useEffect, useState } from 'react';
import { app } from '@microsoft/teams-js';

export function TeamsProvider({ children }: { children: React.ReactNode }) {
    const [isTeams, setIsTeams] = useState(false);

    useEffect(() => {
        const initTeams = async () => {
            try {
                await app.initialize();
                console.log('Microsoft Teams SDK initialized');
                setIsTeams(true);

                // Optional: Get context to see who the user is
                const context = await app.getContext();
                console.log('Teams Context:', context);
            } catch (error) {
                console.log('Not running in Microsoft Teams');
            }
        };

        initTeams();
    }, []);

    return (
        <>
            {children}
        </>
    );
}
