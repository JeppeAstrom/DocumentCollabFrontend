"use client";
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  useEffect(() => {
    const connect = new HubConnectionBuilder()
      .withUrl("https://localhost:7248/documenthub")
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    setConnection(connect);

    connect
      .start()
      .then(() => {
        connect.invoke("JoinDocument", "Jesper").catch((err) => {
          console.error("Error joining group:", err);
        });
        connect.on("ReceiveChanges", (textContent) => {
          setText(textContent);
        });
      })
      .catch((err) => {
        console.error("Error while connecting to SignalR Hub:", err);
      });

    return () => {
      if (connection) {
        connection
          .stop()
          .catch((err) => console.error("Error stopping connection:", err));
      }
    };
  }, []);

  const [text, setText] = useState<string>("");
  const editableDivRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleInput = () => {
    if (editableDivRef.current) {
      const newText = editableDivRef.current.textContent || "";
      setText(newText);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (connection) {
          connection.send("UpdateDocument", "Jesper", newText);
        }
      }, 80);
    }
  };

  useEffect(() => {
    if (editableDivRef.current) {
      const currentText = editableDivRef.current.textContent || "";

      if (currentText !== text) {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        let startOffset = range?.startOffset || 0;

        editableDivRef.current.textContent = text;

        if (range) {
          const newRange = document.createRange();
          const firstChild = editableDivRef.current.firstChild;

          if (firstChild) {
            startOffset = Math.min(
              startOffset,
              firstChild.textContent?.length || 0
            );
            newRange.setStart(firstChild, startOffset);
            newRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      }
    }
  }, [text]);

  //poggers
  return (
    <div className="px-4">
      <div
        ref={editableDivRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning={true}
        className="bg-amber-50 rounded-xl mx-auto my-4 p-4 h-[900px] w-full lg:w-1/3"
      ></div>
    </div>
  );
}
