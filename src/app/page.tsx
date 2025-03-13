"use client";
import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";

const TEXT_DEBOUNCE_TIME = 80;
const CURSOR_DEBOUNCE_TIME = 10;

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
          setText((prevText) =>
            prevText !== textContent ? textContent : prevText
          );
        });

        connect.on("ReceiveCursor", (user, position) => {
          setCursors((prev) => ({ ...prev, [user]: position }));
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
  const cursorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [cursors, setCursors] = useState<{ [key: string]: number }>({});

  const handleInput = () => {
    if (editableDivRef.current) {
      const newText = editableDivRef.current.textContent || "";
      setText(newText);

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const cursorPos = range.startOffset;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (connection) {
            connection.send("UpdateDocument", "Jesper", newText);
            debounceCursorUpdate(cursorPos);
          }
        }, TEXT_DEBOUNCE_TIME);
      }
    }
  };

  const debounceCursorUpdate = (cursorPos: number) => {
    if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
    cursorDebounceRef.current = setTimeout(() => {
      if (connection) {
        connection.send("UpdateCursor", "Jesper", cursorPos);
      }
    }, CURSOR_DEBOUNCE_TIME);
  };

  useEffect(() => {
    if (editableDivRef.current) {
      const currentText = editableDivRef.current.textContent || "";

      if (currentText !== text) {
        const selection = window.getSelection();

        let range = null;
        let startOffset = 0;
        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
          startOffset = range.startOffset;
        }

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

  const getCaretCoordinates = (pos: number) => {
    if (!editableDivRef.current) return null;

    const range = document.createRange();
    let charIndex = 0;
    let node = null;

    for (let i = 0; i < editableDivRef.current.childNodes.length; i++) {
      node = editableDivRef.current.childNodes[i];

      if (node.nodeType === 3) {
        if (charIndex + node.textContent!.length >= pos) {
          range.setStart(node, pos - charIndex);
          range.setEnd(node, pos - charIndex);
          break;
        }
        charIndex += node.textContent!.length;
      }
    }

    if (!node) return null;

    const rect = range.getBoundingClientRect();
    const editorRect = editableDivRef.current.getBoundingClientRect();
    return {
      x: rect.left - editorRect.left,
      y: rect.top - editorRect.top,
    };
  };

  const renderCursors = () => {
    return Object.entries(cursors).map(([user, pos]) => {
      const coords = getCaretCoordinates(pos);
      return coords ? (
        <div
          key={user}
          className="absolute flex flex-col items-center"
          style={{ left: coords.x, top: coords.y }}
        >
          <span className="text-xs bg-white shadow-md px-1 rounded mb-0.5">
            {user}
          </span>
          <div className="w-1 h-4 bg-blue-500"></div>
        </div>
      ) : null;
    });
  };

  return (
    <div className="px-4">
      <div
        ref={editableDivRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning={true}
        className="bg-amber-50 rounded-xl mx-auto my-4 p-4 h-[900px] w-full lg:w-1/3"
      ></div>
      {renderCursors()}
    </div>
  );
}
