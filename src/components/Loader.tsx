import React from 'react';
import './Loader.css';

const Loader: React.FC = () => {
    return (
        <div className="loader-container">
            <div className="loader">
                <div className="pencil">
                    <p>Loading...</p>
                    <div className="top"></div>
                </div>
                <div className="stroke"></div>
            </div>
        </div>
    );
};

export default Loader;
