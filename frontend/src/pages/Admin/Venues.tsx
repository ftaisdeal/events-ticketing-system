import React from 'react';
import { Link } from 'react-router-dom';

const AdminVenues = (): JSX.Element => {
	return (
		<section>
			<h1 className="page-title">Venues</h1>
			<div className="panel-card">
				<p>
					<Link to="/admin/venues/new" className="action-btn action-btn--primary">
						add venue
					</Link>
				</p>
				<p>Admin venues page placeholder.</p>
			</div>
		</section>
	);
};

export default AdminVenues;
