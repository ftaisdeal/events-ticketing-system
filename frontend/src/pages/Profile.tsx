import React from 'react';

import { useAuth } from '../contexts/AuthContext';

const Profile = (): JSX.Element => {
	const { user } = useAuth();

	if (!user) {
		return <p className="error-text">No profile available.</p>;
	}

	return (
		<section>
			<h1 className="page-title">Profile</h1>
			<div className="panel-card">
				<p>
					<strong>Name:</strong> {user.firstName} {user.lastName}
				</p>
				<p>
					<strong>Email:</strong> {user.email}
				</p>
				<p>
					<strong>Role:</strong> {user.role}
				</p>
			</div>
		</section>
	);
};

export default Profile;
