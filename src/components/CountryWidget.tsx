import React, { useState, useEffect } from 'react';
            import { FaGlobe } from 'react-icons/fa';
            
            const CountryWidget: React.FC = () => {
              const [country, setCountry] = useState("...");
            
              useEffect(() => {
                const fetchCountry = async () => {
                  try {
                    const res = await fetch("https://ipwho.is/");
                    if (!res.ok) throw new Error("Failed to fetch location");
                    const data = await res.json();
                    setCountry(data.country || "Unknown");
                  } catch (err) {
                    console.error("Geolocation API error:", err);
                    setCountry("Unknown");
                  }
                };
            
                fetchCountry();
              }, []);
            
              return (
                <div className="">
                  <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <FaGlobe className="text-white text-xl" />
                  </div>
                  <p className="text-[10px] text-center text-green-400 mt-2 flex items-center justify-center gap-3">
                    Connected: {country}
                  </p>
                </div>
              );
            };
            
            export default CountryWidget;