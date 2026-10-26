import { render, waitFor, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import ChatMessage from "@/components/chat/ChatMessage";
const spec = JSON.stringify({title:"Compare",blocks:[{type:"table",columns:["","iPhone 16","S25"],rows:[["Price","$799","$699"]]},{type:"buttons",items:[{label:"More"}]}]},null,2);
it("renders a ui card even with dollar signs", async () => {
  const r = render(<ChatMessage role="assistant" content={"Here:\n```ui\n" + spec + "\n```"} {...({} as any)} />);
  await waitFor(() => expect(r.container.textContent).toContain("iPhone 16"), { timeout: 10000 });
  expect(r.container.textContent).not.toContain('"type"');
});
it("keeps native choices interactive and sends the selected value back to chat", async () => {
  const onSend = vi.fn();
  const source = 'root = Col([RadioGroup($activity, ["Travel", "Sport"], "Activity", "cards"), Button("Confirm", @ToAssistant("My activity", {Activity: $activity}))], 4)\n$activity = "Travel"';
  const r = render(<ChatMessage role="assistant" content={'**Visible**\n```openui\n' + source + '\n```'} onStructuredAction={onSend} {...({} as any)} />);
  await waitFor(() => expect(r.getByRole("button", { name: "Confirm" })).toBeTruthy(), { timeout: 10000 });
  fireEvent.click(r.getByRole("radio", { name: "Sport" }));
  fireEvent.click(r.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.stringContaining("Sport")));
});
