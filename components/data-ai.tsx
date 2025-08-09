"use client";

import { useState, useEffect, useCallback } from "react";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY!,
  dangerouslyAllowBrowser: true,
});

export const DataAI = () => {
  const [advice, setAdvice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [financialData, setFinancialData] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hasFetchedAdvice, setHasFetchedAdvice] = useState(false);
  const [hasFetchedData, setHasFetchedData] = useState(false);

  const fetchFinancialData = async () => {
    if (hasFetchedData) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/summary");
      const data = await response.json();
      setFinancialData(data.data);
      setDataLoaded(true);
      setHasFetchedData(true);
    } catch {
      setAdvice("Sorry, I couldn't fetch the financial data at this moment. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFinancialAdvice = useCallback(async () => {
    if (!financialData || hasFetchedAdvice) return;
    setIsLoading(true);
    setAdvice("");
    try {
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Based on the following financial data: 
            - Remaining: ${(financialData.remainingAmount) / 1000} INR
            - Expense: ${(financialData.expenseAmount) / 1000} INR
            - Income: ${(financialData.incomeAmount) / 1000} INR
            Provide a brief (65 words max) evaluation of the financial situation by comparing the percentage of remaining and the expense. Avoid bullet points and use casual English. Refer to me as "you". Also do not mention my own data if not necessary. Tone could be negative and positive as well..just talk like a friend. but always give a suggestion to improve or to invest. dont only sound like a moral support but give me a precise thing to do next. Suggest like a professional financer`,
          },
        ],
        model: "llama3-8b-8192",
      });
      setAdvice(response.choices[0]?.message?.content || "No advice returned.");
      setHasFetchedAdvice(true);
    } catch {
      setAdvice("Sorry, I couldn't fetch the financial advice at this moment. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [financialData, hasFetchedAdvice]);

  useEffect(() => {
    const fetchDataAndAdvice = async () => {
      await fetchFinancialData();
      if (financialData && !hasFetchedAdvice) {
        await fetchFinancialAdvice();
      }
    };
    fetchDataAndAdvice();
  }, [fetchFinancialAdvice, financialData, hasFetchedAdvice]);

  return (
    <div className="max-w-screen-2xl mx-auto mb-8 px-4 py-4 rounded-lg border-2 border-blue-600 w-[calc(100%-8px)]">
      {dataLoaded ? (
        <h2 className="text-black font-bold text-2xl mx-4 mb-2">SpendFriend AI 🌟</h2>
      ) : (
        <div className="text-gray-400 font-bold text-2xl mx-4 mb-2 animate-pulse">
          SpendFriend AI 🌟
        </div>
      )}
      <div className="px-4 text-gray-600 text-base">
        {isLoading ? (
          <div className="w-full bg-gray-200 h-6 rounded animate-pulse"></div>
        ) : (
          advice
        )}
      </div>
    </div>
  );
};

export default DataAI;
