"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

export const DataAI = () => {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const accountId = searchParams.get("accountId") || "";

  const [advice, setAdvice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchFinancialAdvice = useCallback(async () => {
    setIsLoading(true);
    setAdvice("");
    
    try {
      const query = new URLSearchParams({
        from: from,
        to: to,
        accountId: accountId,
      });

      const response = await fetch(`/api/ai?${query.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch advice");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setAdvice((prev) => prev + chunk);
        setIsLoading(false);
      }

    } catch (err) {
      console.error("AI Advice Error:", err);
      setAdvice("Sorry, I couldn't fetch the financial advice at this moment. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, accountId]);

  useEffect(() => {
    fetchFinancialAdvice();
  }, [fetchFinancialAdvice]);

  return (
    <div className="max-w-screen-2xl mx-auto mb-8 px-4 py-4 rounded-lg border-2 border-blue-600 w-[calc(100%-8px)] bg-white">
      {!isLoading || advice ? (
        <h2 className="text-black font-bold text-2xl mx-4 mb-2">SpendFriend AI 🌟</h2>
      ) : (
        <div className="text-gray-400 font-bold text-2xl mx-4 mb-2 animate-pulse">
          SpendFriend AI 🌟
        </div>
      )}
      <div className="px-4 text-gray-600 text-base min-h-[40px]">
        {isLoading && !advice ? (
          <div className="w-full bg-gray-200 h-6 rounded animate-pulse"></div>
        ) : (
          advice
        )}
      </div>
    </div>
  );
};

export default DataAI;
