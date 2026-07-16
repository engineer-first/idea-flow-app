import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ideaSupportContents } from "../logic/idea-support-content";

export function IdeaSupportSidebarContent() {
  return (
    <div className="flex-1 overflow-auto">
      <Tabs defaultValue="osborn" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {ideaSupportContents.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="
                flex-1
                rounded-none
                border-0
                border-b-2
                border-transparent
                bg-transparent
                shadow-none
                focus-visible:ring-0
                data-[state=active]:border-primary
                data-[state=active]:bg-transparent
                data-[state=active]:shadow-none
              "
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Separator />

        <div className="p-4">
          {ideaSupportContents.map((item) => (
            <TabsContent key={item.id} value={item.id}>
              <h3 className="mb-3 font-semibold">{item.title}</h3>

              <ul className="space-y-2">
                {item.content.map((text) => (
                  <li key={text} className="text-sm">
                    ・{text}
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
