import React, { useState, useEffect } from "react";
import axios from "axios";

const UpdatePricing = () => {
  const [pricing, setPricing] = useState([]);
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    axios.get("/api/pricing").then(res => setPricing(res.data));
  }, []);

  const updatePrice = async (id) => {
    await axios.post("/api/pricing", {
      ...pricing.find(p => p._id === id),
      price: parseFloat(newPrice)
    });
    window.location.reload();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Update Ticket Pricing</h2>
      {pricing.map((p) => (
        <div key={p._id} className="border p-4 mb-2 rounded">
          <p><strong>{p.seatType}</strong> — ₹{p.price}</p>
          <input
            type="number"
            placeholder="New Price"
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <button onClick={() => updatePrice(p._id)}>Update</button>
        </div>
      ))}
    </div>
  );
};

export default UpdatePricing;
